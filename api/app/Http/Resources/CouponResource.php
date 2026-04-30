<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CouponResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                         => $this->id,
            'organization_id'            => $this->organization_id,
            'workshop_id'                => $this->workshop_id,
            'workshop_title'             => $this->workshop?->title,
            'code'                       => $this->code,
            'label'                      => $this->label,
            'description'                => $this->description,
            'discount_type'              => $this->discount_type,
            'discount_pct'               => $this->discount_pct,
            'discount_amount_cents'      => $this->discount_amount_cents,
            'discount_formatted'         => $this->getFormattedDiscount(),
            'applies_to'                 => $this->applies_to,
            'minimum_order_cents'        => $this->minimum_order_cents,
            'minimum_order_formatted'    => '$' . number_format($this->minimum_order_cents / 100, 2),
            'max_redemptions'            => $this->max_redemptions,
            'max_redemptions_per_user'   => $this->max_redemptions_per_user,
            'redemption_count'           => $this->redemption_count,
            'total_discount_given_cents' => $this->total_discount_given_cents,
            'total_discount_given_formatted' => '$' . number_format($this->total_discount_given_cents / 100, 2),
            'is_active'                  => $this->is_active,
            'valid_from'                 => $this->valid_from?->toIso8601String(),
            'valid_until'                => $this->valid_until?->toIso8601String(),
            'created_at'                 => $this->created_at->toIso8601String(),

            // Recent redemptions — only included when explicitly loaded.
            'recent_redemptions' => $this->when(
                $this->relationLoaded('redemptions'),
                fn () => CouponRedemptionResource::collection($this->redemptions)
            ),
        ];
    }
}
