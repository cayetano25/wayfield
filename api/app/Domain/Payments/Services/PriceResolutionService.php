<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\NextTierInfo;
use App\Domain\Payments\DTOs\PriceResolution;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Models\Registration;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class PriceResolutionService
{
    private const REGISTRATION_CACHE_TTL = 30;
    private const RESOLUTION_CACHE_TTL   = 60;

    public function resolve(
        Workshop $workshop,
        ?Carbon $at = null,
        bool $useCache = true,
    ): PriceResolution {
        $at ??= now();

        if ($useCache) {
            $data = Cache::remember(
                $this->resolutionCacheKey($workshop->id),
                self::RESOLUTION_CACHE_TTL,
                fn () => $this->computeResolution($workshop, $at)->toArray(),
            );

            return PriceResolution::fromArray($data);
        }

        return $this->computeResolution($workshop, $at);
    }

    public function resolveForCart(Workshop $workshop, Cart $cart): PriceResolution
    {
        // If the cart already has a locked tier price for this workshop, honour it.
        $lockedItem = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where('item_type', 'workshop_registration')
            ->where('workshop_id', $workshop->id)
            ->where('is_tier_price', true)
            ->first();

        if ($lockedItem !== null && $lockedItem->applied_tier_id !== null) {
            $tier    = WorkshopPriceTier::find($lockedItem->applied_tier_id);
            $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

            return new PriceResolution(
                priceCents:        $lockedItem->unit_price_cents,
                currency:          'usd',
                tierId:            $lockedItem->applied_tier_id,
                tierLabel:         $lockedItem->applied_tier_label,
                isTierPrice:       true,
                remainingCapacity: $tier?->getRemainingCapacity($this->getRegistrationCount($workshop->id)),
                nextTier:          null,
                basePriceCents:    $pricing?->base_price_cents ?? 0,
            );
        }

        return $this->resolve($workshop);
    }

    public function buildPublicPricingDisplay(Workshop $workshop): array
    {
        $resolution = $this->resolve($workshop);

        $nextPriceChange = null;
        if ($resolution->nextTier !== null) {
            $next = $resolution->nextTier;

            $urgency = 'none';
            if ($next->activatesAt !== null) {
                $hoursUntil = now()->diffInHours($next->activatesAt, false);
                if ($hoursUntil <= 48) {
                    $urgency = 'urgent';
                } elseif ($hoursUntil <= 168) {
                    $urgency = 'soon';
                }
            }

            $nextPriceChange = [
                'price_cents'           => $next->priceCents,
                'tier_label'            => $next->tierLabel,
                'changes_at'            => $next->activatesAt?->toIso8601String(),
                'changes_at_capacity'   => $next->activatesAtCapacity,
                'change_direction'      => $next->changeDirection,
                'urgency'               => $urgency,
            ];
        }

        return [
            'current_price_cents'          => $resolution->priceCents,
            'current_tier_label'           => $resolution->tierLabel,
            'base_price_cents'             => $resolution->basePriceCents,
            'is_tier_price'                => $resolution->isTierPrice,
            'show_original_price'          => $resolution->isTierPrice && $resolution->priceCents < $resolution->basePriceCents,
            'next_price_change'            => $nextPriceChange,
            'remaining_at_current_price'   => $resolution->remainingCapacity,
        ];
    }

    public function bustCache(int $workshopId): void
    {
        Cache::forget($this->resolutionCacheKey($workshopId));
    }

    // ─── Resolution algorithm ─────────────────────────────────────────────────

    private function computeResolution(Workshop $workshop, Carbon $at): PriceResolution
    {
        $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();

        if ($pricing === null || $pricing->base_price_cents === 0) {
            return $this->basePriceResolution(0, $pricing);
        }

        $tiers = WorkshopPriceTier::query()
            ->activeForWorkshop($workshop->id)
            ->get();

        if ($tiers->isEmpty()) {
            return $this->basePriceResolution($pricing->base_price_cents, $pricing);
        }

        $registrationCount = $this->getRegistrationCount($workshop->id);

        $winningTier = null;
        foreach ($tiers as $tier) {
            if ($tier->isEligible($at, $registrationCount)) {
                $winningTier = $tier;
                break;
            }
        }

        if ($winningTier === null) {
            return $this->basePriceResolution($pricing->base_price_cents, $pricing);
        }

        $nextTier = $this->resolveNextTier($tiers, $winningTier, $at, $registrationCount, $pricing->base_price_cents);

        return new PriceResolution(
            priceCents:        $winningTier->price_cents,
            currency:          'usd',
            tierId:            $winningTier->id,
            tierLabel:         $winningTier->label,
            isTierPrice:       true,
            remainingCapacity: $winningTier->getRemainingCapacity($registrationCount),
            nextTier:          $nextTier,
            basePriceCents:    $pricing->base_price_cents,
        );
    }

    private function basePriceResolution(int $priceCents, ?WorkshopPricing $pricing): PriceResolution
    {
        return new PriceResolution(
            priceCents:        $priceCents,
            currency:          'usd',
            tierId:            null,
            tierLabel:         null,
            isTierPrice:       false,
            remainingCapacity: null,
            nextTier:          null,
            basePriceCents:    $pricing?->base_price_cents ?? $priceCents,
        );
    }

    private function resolveNextTier(
        \Illuminate\Support\Collection $tiers,
        WorkshopPriceTier $winningTier,
        Carbon $at,
        int $registrationCount,
        int $basePriceCents,
    ): ?NextTierInfo {
        // Look for the next tier that could become active after the winning tier.
        foreach ($tiers as $tier) {
            if ($tier->id === $winningTier->id) {
                continue;
            }

            // Already active — not "next".
            if ($tier->isEligible($at, $registrationCount)) {
                continue;
            }

            // Date-triggered: valid_from in the future.
            $isDateFuture = $tier->valid_from !== null && $tier->valid_from->gt($at);

            // Capacity-triggered: capacity_limit exists but not yet reached by winning tier.
            $isCapacityFuture = $tier->capacity_limit !== null
                && $registrationCount < $tier->capacity_limit;

            if (! $isDateFuture && ! $isCapacityFuture) {
                continue;
            }

            // Determine the price after this tier relative to the winning tier's price.
            // The "next" price after winning tier ends could be another tier or base price.
            $nextPrice     = $tier->price_cents;
            $direction     = $nextPrice > $winningTier->price_cents ? 'increase' : 'decrease';
            $activatesAt   = $isDateFuture ? $tier->valid_from : null;

            // If this tier activates when the winning tier's capacity is exhausted,
            // use the winning tier's capacity_limit as the trigger.
            $activatesAtCapacity = null;
            if (! $isDateFuture && $isCapacityFuture) {
                $activatesAtCapacity = $winningTier->capacity_limit;
            }

            return new NextTierInfo(
                priceCents:          $nextPrice,
                tierLabel:           $tier->label,
                activatesAt:         $activatesAt,
                activatesAtCapacity: $activatesAtCapacity,
                changeDirection:     $direction,
            );
        }

        // If the winning tier has a valid_until or capacity_limit, the price
        // will revert to base price when it expires. Model that as the next tier.
        $winnerExpires = $winningTier->valid_until !== null && $winningTier->valid_until->gt($at);
        $winnerHasCap  = $winningTier->capacity_limit !== null;

        if ($winnerExpires || $winnerHasCap) {
            $direction = $basePriceCents > $winningTier->price_cents ? 'increase' : 'decrease';

            return new NextTierInfo(
                priceCents:          $basePriceCents,
                tierLabel:           'Standard',
                activatesAt:         $winnerExpires ? $winningTier->valid_until : null,
                activatesAtCapacity: $winnerHasCap ? $winningTier->capacity_limit : null,
                changeDirection:     $direction,
            );
        }

        return null;
    }

    private function getRegistrationCount(int $workshopId): int
    {
        return (int) Cache::remember(
            "registration_count_{$workshopId}",
            self::REGISTRATION_CACHE_TTL,
            fn () => Registration::query()
                ->where('workshop_id', $workshopId)
                ->whereIn('registration_status', ['registered', 'waitlisted'])
                ->count(),
        );
    }

    private function resolutionCacheKey(int $workshopId): string
    {
        return "price_resolution_{$workshopId}";
    }
}
