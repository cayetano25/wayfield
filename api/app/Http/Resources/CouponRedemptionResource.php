<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CouponRedemptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                             => $this->id,
            'order_number'                   => $this->order?->order_number,
            'user_name'                      => trim(($this->user?->first_name ?? '') . ' ' . ($this->user?->last_name ?? '')),
            'discount_amount_cents'          => $this->discount_amount_cents,
            'discount_amount_formatted'      => '$' . number_format($this->discount_amount_cents / 100, 2),
            'pre_discount_subtotal_cents'    => $this->pre_discount_subtotal_cents,
            'pre_discount_subtotal_formatted' => '$' . number_format($this->pre_discount_subtotal_cents / 100, 2),
            'post_discount_total_cents'      => $this->post_discount_total_cents,
            'post_discount_total_formatted'  => '$' . number_format($this->post_discount_total_cents / 100, 2),
            'workshop_title'                 => $this->workshop?->title,
            'coupon_code_snapshot'           => $this->coupon_code_snapshot,
            'discount_type_snapshot'         => $this->discount_type_snapshot,
            'created_at'                     => $this->created_at->toIso8601String(),
        ];
    }
}
