<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Serializes a NotificationRecipient row for the in-app notification center.
 * Includes the parent notification's content fields.
 */
class InAppNotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $notification = $this->notification;

        return [
            'id'                    => $this->id,
            'notification_id'       => $this->notification_id,
            'in_app_status'         => $this->in_app_status,
            'read_at'               => $this->read_at?->toIso8601String(),
            'title'                 => $notification->title,
            'message'               => $notification->message,
            'notification_type'     => $notification->notification_type,
            'notification_category' => $notification->notification_category,
            'action_data'           => $notification->action_data,
            'is_invitation'         => $notification->isInvitation(),
            'workshop_id'           => $notification->workshop_id,
            'session_id'            => $notification->session_id,
            'sent_at'               => $notification->sent_at?->toIso8601String(),
            'created_at'            => $this->created_at->toIso8601String(),
        ];
    }
}
