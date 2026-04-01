<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationPreferenceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'email_enabled'            => $this->email_enabled,
            'push_enabled'             => $this->push_enabled,
            'workshop_updates_enabled' => $this->workshop_updates_enabled,
            'reminder_enabled'         => $this->reminder_enabled,
            'marketing_enabled'        => $this->marketing_enabled,
        ];
    }
}
