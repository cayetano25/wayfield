<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Represents the coupon applied to a cart.
 * Resource is the Cart model.
 */
class CartCouponResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $coupon = $this->appliedCoupon;

        return [
            'code'         => $this->coupon_code_applied,
            'discount_type' => $coupon?->discount_type,
            'discount_pct'  => $coupon?->discount_pct,
            'discount_amount_cents'    => $this->discount_cents,
            'discount_amount_formatted' => '$' . number_format($this->discount_cents / 100, 2),
            'message'      => $coupon?->getFormattedDiscount(),
        ];
    }
}
