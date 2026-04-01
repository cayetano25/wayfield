<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RegistrationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'workshop_id'         => $this->workshop_id,
            'registration_status' => $this->registration_status,
            'registered_at'       => $this->registered_at?->toIso8601String(),
            'canceled_at'         => $this->canceled_at?->toIso8601String(),
        ];
    }
}
