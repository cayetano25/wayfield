<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'organization_id' => $this->organization_id,
            'user_id'         => $this->user_id,
            'role'            => $this->role,
            'is_active'       => $this->is_active,
            'user'            => $this->whenLoaded('user', fn () => [
                'id'         => $this->user->id,
                'first_name' => $this->user->first_name,
                'last_name'  => $this->user->last_name,
                'email'      => $this->user->email,
            ]),
            'created_at'      => $this->created_at->toIso8601String(),
        ];
    }
}
