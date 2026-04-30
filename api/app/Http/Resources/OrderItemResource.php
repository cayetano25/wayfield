<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'item_type'             => $this->item_type,
            'workshop_id'           => $this->workshop_id,
            'session_id'            => $this->session_id,
            'workshop_title'        => $this->workshop?->title,
            'session_title'         => $this->session?->title,
            'unit_price_cents'      => $this->unit_price_cents,
            'applied_tier_label'    => $this->applied_tier_label,
            'is_tier_price'         => (bool) $this->is_tier_price,
            'quantity'              => $this->quantity,
            'line_total_cents'      => $this->line_total_cents,
            'is_deposit'            => $this->is_deposit,
            'refunded_amount_cents' => $this->refunded_amount_cents,
            'refund_status'         => $this->refund_status,
            'currency'              => $this->currency,
        ];
    }
}
