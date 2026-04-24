<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RefundPolicyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                          => $this->id,
            'scope'                       => $this->scope,
            'organization_id'             => $this->organization_id,
            'workshop_id'                 => $this->workshop_id,
            'full_refund_cutoff_days'     => $this->full_refund_cutoff_days,
            'partial_refund_cutoff_days'  => $this->partial_refund_cutoff_days,
            'partial_refund_pct'          => $this->partial_refund_pct,
            'no_refund_cutoff_hours'      => $this->no_refund_cutoff_hours,
            'wayfield_fee_refundable'     => (bool) $this->wayfield_fee_refundable,
            'allow_credits'               => (bool) $this->allow_credits,
            'credit_expiry_days'          => $this->credit_expiry_days,
            'custom_policy_text'          => $this->custom_policy_text,
            'created_at'                  => $this->created_at?->toISOString(),
            'updated_at'                  => $this->updated_at?->toISOString(),
        ];
    }
}
