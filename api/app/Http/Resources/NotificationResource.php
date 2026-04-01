<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'workshop_id'       => $this->workshop_id,
            'session_id'        => $this->session_id,
            'title'             => $this->title,
            'message'           => $this->message,
            'notification_type' => $this->notification_type,
            'sender_scope'      => $this->sender_scope,
            'delivery_scope'    => $this->delivery_scope,
            'sent_at'           => $this->sent_at?->toIso8601String(),
            'recipient_count'   => $this->whenCounted('recipients'),
            'created_at'        => $this->created_at->toIso8601String(),
        ];
    }
}
