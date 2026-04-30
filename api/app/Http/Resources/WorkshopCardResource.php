<?php

namespace App\Http\Resources;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Models\WorkshopFavorite;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Minimal workshop representation for discovery listing cards.
 *
 * FORBIDDEN — never add these fields:
 * - join_code (grants workshop access — extremely sensitive)
 * - participant data, roster, registration counts, phone numbers, emails
 * - logistics hotel_address, hotel_phone, hotel_notes, parking_details, meetup_instructions
 * - session meeting_url, meeting_id, meeting_passcode, meeting_instructions
 * - leader email, phone, full address
 * - any internal org metadata beyond id + name
 */
class WorkshopCardResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'title'               => $this->title,
            'description'         => $this->truncateDescription($this->description),
            'status'              => $this->status,
            'start_date'          => $this->start_date?->toDateString(),
            'end_date'            => $this->end_date?->toDateString(),
            'public_slug'         => $this->public_slug,
            'public_page_enabled' => (bool) $this->public_page_enabled,
            'workshop_type'       => $this->workshop_type,
            'location'            => $this->resolveLocation(),
            'taxonomy'            => $this->resolveTaxonomy(),
            'tags'                => $this->resolveTags(),
            'organization'        => $this->resolveOrganization(),
            'leader_count'        => $this->confirmed_leaders_count ?? 0,
            'pricing'             => $this->resolvePricing(),
            'is_favorited'        => auth()->check()
                ? WorkshopFavorite::where('user_id', auth()->id())
                      ->where('workshop_id', $this->id)
                      ->exists()
                : false,
            'participant_status'  => $this->resolveParticipantStatus(),
            // join_code intentionally absent — triple-checked
        ];
    }

    private function truncateDescription(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        if (mb_strlen($text) <= 160) {
            return $text;
        }

        return mb_substr($text, 0, 160).'…';
    }

    private function resolveLocation(): ?array
    {
        if (! $this->relationLoaded('defaultLocation') || ! $this->defaultLocation) {
            return null;
        }

        return [
            'city'           => $this->defaultLocation->city,
            'state_or_region' => $this->defaultLocation->state_or_region,
            'country'        => $this->defaultLocation->country,
        ];
    }

    private function resolveTaxonomy(): array
    {
        $primary = $this->relationLoaded('primaryTaxonomy') ? $this->primaryTaxonomy : null;

        return [
            'category'       => $primary?->relationLoaded('category') && $primary->category ? [
                'id'   => $primary->category->id,
                'name' => $primary->category->name,
                'slug' => $primary->category->slug,
            ] : null,
            'subcategory'    => $primary?->relationLoaded('subcategory') && $primary->subcategory ? [
                'id'   => $primary->subcategory->id,
                'name' => $primary->subcategory->name,
                'slug' => $primary->subcategory->slug,
            ] : null,
            'specialization' => $primary?->relationLoaded('specialization') && $primary->specialization ? [
                'id'   => $primary->specialization->id,
                'name' => $primary->specialization->name,
                'slug' => $primary->specialization->slug,
            ] : null,
        ];
    }

    private function resolveTags(): array
    {
        if (! $this->relationLoaded('tags')) {
            return [];
        }

        return $this->tags->map(fn ($tag) => [
            'group_key' => $tag->relationLoaded('tagGroup') ? $tag->tagGroup?->key : null,
            'value'     => $tag->value,
            'label'     => $tag->label,
        ])->values()->all();
    }

    private function resolveOrganization(): ?array
    {
        if (! $this->relationLoaded('organization') || ! $this->organization) {
            return null;
        }

        return [
            'id'   => $this->organization->id,
            'slug' => $this->organization->slug,
            'name' => $this->organization->name,
            // primary_contact_* intentionally absent — private org data
        ];
    }

    private function resolveParticipantStatus(): ?array
    {
        if (! auth()->check()) {
            return null;
        }

        $registration = $this->registrations()
            ->where('user_id', auth()->id())
            ->first();

        if (! $registration) {
            return null;
        }

        $order = Order::where('user_id', auth()->id())
            ->whereHas('items', fn ($q) => $q->where('workshop_id', $this->id))
            ->whereIn('status', ['completed', 'partially_refunded'])
            ->orderByDesc('completed_at')
            ->first();

        return [
            'registration_status' => $registration->registration_status,
            'payment_status'      => $order?->getPaymentStatusLabel() ?? 'free',
            'is_paid'             => $order !== null,
            'order_number'        => $order?->order_number,
            'is_deposit_only'     => $order?->isDepositOnly() ?? false,
            'balance_due_date'    => $order?->balance_due_date?->toDateString(),
        ];
    }

    private function resolvePricing(): ?array
    {
        $pricing = $this->relationLoaded('pricing') ? $this->pricing : null;

        if ($pricing === null || ! $pricing->is_paid) {
            return null;
        }

        return app(PriceResolutionService::class)->buildPublicPricingDisplay($this->resource);
    }
}
