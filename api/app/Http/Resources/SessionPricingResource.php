<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SessionPricingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'session_id'       => $this->session_id,
            'price_cents'      => $this->price_cents,
            'price'            => number_format($this->price_cents / 100, 2),
            'currency'         => $this->currency ?? 'usd',
            'is_nonrefundable' => (bool) $this->is_nonrefundable,
            'max_purchases'    => $this->max_purchases,
            'created_at'       => $this->created_at?->toISOString(),
            'updated_at'       => $this->updated_at?->toISOString(),
        ];
    }
}
