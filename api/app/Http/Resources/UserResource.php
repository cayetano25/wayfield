<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'first_name'          => $this->first_name,
            'last_name'           => $this->last_name,
            'email'               => $this->email,
            'profile_image_url'   => $this->profile_image_url,
            'email_verified'      => $this->hasVerifiedEmail(),
            'email_verified_at'   => $this->email_verified_at?->toIso8601String(),
            'is_active'                => $this->is_active,
            'last_login_at'            => $this->last_login_at?->toIso8601String(),
            'onboarding_intent'        => $this->onboarding_intent,
            'onboarding_completed_at'  => $this->onboarding_completed_at?->toIso8601String(),
            'created_at'               => $this->created_at->toIso8601String(),
        ];
    }
}
