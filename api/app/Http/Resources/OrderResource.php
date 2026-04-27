<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                      => $this->id,
            'order_number'            => $this->order_number,
            'organization_id'         => $this->organization_id,
            'status'                  => $this->status,
            'payment_status_label'    => $this->getPaymentStatusLabel(),
            'payment_method'          => $this->payment_method,
            'subtotal_cents'          => $this->subtotal_cents,
            'wayfield_fee_cents'      => $this->wayfield_fee_cents,
            'stripe_fee_cents'        => $this->stripe_fee_cents,
            'total_cents'             => $this->total_cents,
            'organizer_payout_cents'  => $this->organizer_payout_cents,
            'currency'                => $this->currency,
            'is_deposit_order'        => $this->is_deposit_order,
            'deposit_paid_at'         => $this->deposit_paid_at?->toIso8601String(),
            'balance_due_date'        => $this->balance_due_date?->toDateString(),
            'balance_amount_cents'    => $this->balance_amount_cents,
            'balance_paid_at'         => $this->balance_paid_at?->toIso8601String(),
            'completed_at'            => $this->completed_at?->toIso8601String(),
            'created_at'              => $this->created_at->toIso8601String(),
            'items'                   => OrderItemResource::collection($this->whenLoaded('items')),
            'refund_requests'         => $this->when(
                $this->relationLoaded('refundRequests'),
                fn () => $this->refundRequests->count()
            ),
        ];
    }
}
