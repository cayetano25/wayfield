<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\FeeBreakdown;
use App\Domain\Payments\Models\PlatformTakeRate;
use App\Models\Organization;

class FeeCalculationService
{
    /** @var array<string, float> In-process cache: plan_code => take_rate_pct */
    private static array $takeRateCache = [];

    private const STRIPE_VARIABLE_RATE = 0.029;
    private const STRIPE_FLAT_FEE_CENTS = 30;
    private const DEFAULT_PLAN_CODE = 'foundation';

    public function calculateFees(
        int $amountCents,
        string $planCode,
        string $currency = 'usd',
    ): FeeBreakdown {
        $takeRatePct = $this->getForPlan($planCode);

        // Stripe fee: floor(amount * 0.029) + 30 cents flat
        $stripeFeeCents = (int) floor($amountCents * self::STRIPE_VARIABLE_RATE) + self::STRIPE_FLAT_FEE_CENTS;

        // Wayfield fee: floor(amount * take_rate)
        $wayFieldFeeCents = (int) floor($amountCents * $takeRatePct);

        $totalFeeCents = $wayFieldFeeCents + $stripeFeeCents;
        $organizerPayoutCents = $amountCents - $totalFeeCents;

        return new FeeBreakdown(
            amountCents: $amountCents,
            wayFieldFeeCents: $wayFieldFeeCents,
            stripeFeeCents: $stripeFeeCents,
            totalFeeCents: $totalFeeCents,
            organizerPayoutCents: $organizerPayoutCents,
            takeRatePct: $takeRatePct,
            currency: $currency,
        );
    }

    public function formatCents(int $cents, string $currency = 'usd'): string
    {
        return '$' . number_format($cents / 100, 2);
    }

    public function getTakeRateForOrganization(Organization $org): float
    {
        $planCode = $org->activeSubscription?->plan_code ?? self::DEFAULT_PLAN_CODE;

        return $this->getForPlan($planCode);
    }

    /**
     * Looks up take rate for the given plan code.
     * Results are cached per process to avoid DB queries on every fee calculation.
     */
    private function getForPlan(string $planCode): float
    {
        if (isset(self::$takeRateCache[$planCode])) {
            return self::$takeRateCache[$planCode];
        }

        $rate = PlatformTakeRate::query()
            ->where('plan_code', $planCode)
            ->where('is_active', true)
            ->value('take_rate_pct');

        if ($rate === null) {
            // Fall back to foundation rate if plan_code not found in DB.
            $rate = PlatformTakeRate::query()
                ->where('plan_code', self::DEFAULT_PLAN_CODE)
                ->where('is_active', true)
                ->value('take_rate_pct') ?? 0.0650;
        }

        self::$takeRateCache[$planCode] = (float) $rate;

        return self::$takeRateCache[$planCode];
    }

    /** Clears the in-process cache — useful in tests between scenarios. */
    public static function flushCache(): void
    {
        self::$takeRateCache = [];
    }
}
