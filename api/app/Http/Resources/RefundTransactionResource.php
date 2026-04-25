<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RefundTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'refund_request_id' => $this->refund_request_id,
            'order_id'          => $this->order_id,
            'stripe_refund_id'  => $this->stripe_refund_id,
            'amount_cents'      => $this->amount_cents,
            'currency'          => $this->currency,
            'status'            => $this->status,
            'failure_reason'    => $this->failure_reason,
            'stripe_created_at' => $this->stripe_created_at?->toIso8601String(),
            'created_at'        => $this->created_at->toIso8601String(),
        ];
    }
}
