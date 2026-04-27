<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RefundRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                     => $this->id,
            'order_id'               => $this->order_id,
            'order_item_id'          => $this->order_item_id,
            'requested_by_user_id'   => $this->requested_by_user_id,
            'requested_by'           => $this->when(
                $this->relationLoaded('requestedBy') && $this->requestedBy !== null,
                fn () => [
                    'id'         => $this->requestedBy->id,
                    'first_name' => $this->requestedBy->first_name,
                    'last_name'  => $this->requestedBy->last_name,
                    'email'      => $this->requestedBy->email,
                ],
            ),
            'reason_code'            => $this->reason_code,
            'reason_text'            => $this->reason_text,
            'requested_amount_cents' => $this->requested_amount_cents,
            'approved_amount_cents'  => $this->approved_amount_cents,
            'status'                 => $this->status,
            'auto_eligible'          => $this->auto_eligible,
            'policy_applied_scope'   => $this->policy_applied_scope,
            'reviewed_by_user_id'    => $this->reviewed_by_user_id,
            'reviewed_at'            => $this->reviewed_at?->toIso8601String(),
            'review_notes'           => $this->review_notes,
            'processed_at'           => $this->processed_at?->toIso8601String(),
            'created_at'             => $this->created_at->toIso8601String(),
            'order'                  => $this->when(
                $this->relationLoaded('order'),
                fn () => new OrderResource($this->order),
            ),
            'refund_transactions'    => RefundTransactionResource::collection(
                $this->whenLoaded('refundTransactions')
            ),
        ];
    }
}
