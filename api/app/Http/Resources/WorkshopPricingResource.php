<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkshopPricingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                          => $this->id,
            'workshop_id'                 => $this->workshop_id,
            'base_price_cents'            => $this->base_price_cents,
            'base_price'                  => number_format($this->base_price_cents / 100, 2),
            'currency'                    => $this->currency ?? 'usd',
            'is_paid'                     => $this->is_paid,
            'deposit_enabled'             => (bool) $this->deposit_enabled,
            'deposit_amount_cents'        => $this->deposit_amount_cents,
            'deposit_amount'              => $this->deposit_amount_cents !== null
                ? number_format($this->deposit_amount_cents / 100, 2)
                : null,
            'deposit_is_nonrefundable'    => (bool) $this->deposit_is_nonrefundable,
            'balance_due_date'            => $this->balance_due_date?->toDateString(),
            'balance_auto_charge'         => (bool) $this->balance_auto_charge,
            'balance_reminder_days'       => $this->balance_reminder_days ?? [],
            'minimum_attendance'          => $this->minimum_attendance,
            'commitment_date'             => $this->commitment_date?->toDateString(),
            'commitment_description'      => $this->commitment_description,
            'commitment_reminder_days'    => $this->commitment_reminder_days ?? [],
            'post_commitment_refund_pct'  => $this->post_commitment_refund_pct,
            'post_commitment_refund_note' => $this->post_commitment_refund_note,
            'created_at'                  => $this->created_at?->toISOString(),
            'updated_at'                  => $this->updated_at?->toISOString(),
        ];
    }
}
