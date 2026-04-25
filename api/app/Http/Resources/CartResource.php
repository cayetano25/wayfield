<?php

namespace App\Http\Resources;

use App\Domain\Payments\DTOs\FeeBreakdown;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    private ?FeeBreakdown $fees;

    public function withFees(?FeeBreakdown $fees): static
    {
        $this->fees = $fees;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'organization_id'  => $this->organization_id,
            'status'           => $this->status,
            'subtotal_cents'   => $this->subtotal_cents,
            'currency'         => $this->currency,
            'expires_at'       => $this->expires_at?->toIso8601String(),
            'items'            => CartItemResource::collection($this->whenLoaded('items')),
            'fee_breakdown'    => $this->when($this->fees !== null, fn () => [
                'wayfield_fee_cents'   => $this->fees->wayFieldFeeCents,
                'stripe_fee_cents'     => $this->fees->stripeFeeCents,
                'total_fee_cents'      => $this->fees->totalFeeCents,
                'organizer_payout_cents' => $this->fees->organizerPayoutCents,
                'take_rate_pct'        => $this->fees->takeRatePct,
            ]),
        ];
    }
}
