<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PushTokenResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'platform'           => $this->platform,
            'push_token'         => $this->push_token,
            'is_active'          => $this->is_active,
            'last_registered_at' => $this->last_registered_at->toIso8601String(),
        ];
    }
}
