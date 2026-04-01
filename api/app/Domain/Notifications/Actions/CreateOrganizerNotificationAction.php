<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Services\QueueNotificationDeliveryAction;
use App\Domain\Notifications\Services\ResolveNotificationRecipientsService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Notification;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;

class CreateOrganizerNotificationAction
{
    public function __construct(
        private readonly ResolveNotificationRecipientsService $recipientResolver,
        private readonly QueueNotificationDeliveryAction $queueDelivery,
    ) {}

    /**
     * Create an organizer-scoped notification for a workshop.
     *
     * Organizers may target:
     *   - all_participants
     *   - leaders
     *   - session_participants (requires session_id)
     *
     * 'custom' delivery scope is reserved for future implementation.
     * See README.md Open Issues — no data model exists for this yet.
     *
     * @param array{
     *   title: string,
     *   message: string,
     *   notification_type: string,
     *   delivery_scope: string,
     *   session_id?: int|null,
     * } $data
     */
    public function execute(User $organizer, Workshop $workshop, array $data): Notification
    {
        $notification = Notification::create([
            'organization_id'    => $workshop->organization_id,
            'workshop_id'        => $workshop->id,
            'created_by_user_id' => $organizer->id,
            'title'              => $data['title'],
            'message'            => $data['message'],
            'notification_type'  => $data['notification_type'] ?? 'informational',
            'sender_scope'       => 'organizer',
            'delivery_scope'     => $data['delivery_scope'],
            'session_id'         => $data['session_id'] ?? null,
            'sent_at'            => Carbon::now(),
        ]);

        // Resolve recipients and create notification_recipient rows
        $recipients = $this->recipientResolver->resolve($notification);

        // Queue delivery for each channel
        $this->queueDelivery->dispatch($notification, $recipients);

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id'   => $organizer->id,
            'entity_type'     => 'notification',
            'entity_id'       => $notification->id,
            'action'          => 'organizer_notification_sent',
            'metadata'        => [
                'workshop_id'     => $workshop->id,
                'delivery_scope'  => $data['delivery_scope'],
                'recipient_count' => $recipients->count(),
                'sent_at'         => $notification->sent_at->toIso8601String(),
            ],
        ]);

        return $notification->loadCount('recipients');
    }
}
