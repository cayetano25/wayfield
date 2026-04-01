<?php

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Services\EnforceLeaderMessagingRulesService;
use App\Domain\Notifications\Services\QueueNotificationDeliveryAction;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use Carbon\Carbon;

class CreateLeaderNotificationAction
{
    public function __construct(
        private readonly EnforceLeaderMessagingRulesService $messagingRules,
        private readonly QueueNotificationDeliveryAction $queueDelivery,
    ) {}

    /**
     * Create a leader notification for a session's participants.
     *
     * Enforces:
     * - Leader must be assigned to the session
     * - Time window must be valid (workshop timezone)
     * - Recipients are resolved from session participants only
     *
     * @param array{title: string, message: string, notification_type: string} $data
     */
    public function execute(User $user, Session $session, array $data): Notification
    {
        $session->loadMissing('workshop');

        // This will throw LeaderMessagingScopeException or LeaderMessagingWindowException
        // if the leader is not authorized.
        $leader = $this->messagingRules->enforce($user, $session);

        $workshop = $session->workshop;

        // Create the notification record
        $notification = Notification::create([
            'organization_id'    => $workshop->organization_id,
            'workshop_id'        => $workshop->id,
            'session_id'         => $session->id,
            'created_by_user_id' => $user->id,
            'title'              => $data['title'],
            'message'            => $data['message'],
            'notification_type'  => $data['notification_type'] ?? 'informational',
            'sender_scope'       => 'leader',
            'delivery_scope'     => 'session_participants',
            'sent_at'            => Carbon::now(),
        ]);

        // Resolve recipients from this session's participants only
        $recipientUserIds = $this->resolveSessionParticipants($session, $workshop->id);

        foreach ($recipientUserIds as $recipientUserId) {
            NotificationRecipient::create([
                'notification_id' => $notification->id,
                'user_id'         => $recipientUserId,
                'email_status'    => 'pending',
                'push_status'     => 'pending',
                'in_app_status'   => 'pending',
            ]);
        }

        $recipientCount = count($recipientUserIds);

        // Queue email and push delivery for all pending recipients
        $this->queueDelivery->dispatch(
            $notification,
            $notification->recipients()->get()
        );

        // Mandatory audit log for every leader notification
        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id'   => $user->id,
            'entity_type'     => 'notification',
            'entity_id'       => $notification->id,
            'action'          => 'leader_notification_sent',
            'metadata'        => [
                'leader_id'        => $leader->id,
                'session_id'       => $session->id,
                'workshop_id'      => $workshop->id,
                'organization_id'  => $workshop->organization_id,
                'recipient_count'  => $recipientCount,
                'sent_at'          => $notification->sent_at->toIso8601String(),
            ],
        ]);

        return $notification->loadCount('recipients');
    }

    /**
     * Resolve the user IDs of eligible session participants.
     *
     * session_based: users with active session_selection for this session
     * event_based: users actively registered to the workshop
     */
    private function resolveSessionParticipants(Session $session, int $workshopId): array
    {
        $session->loadMissing('workshop');

        if ($session->workshop->isSessionBased()) {
            return SessionSelection::join('registrations', 'registrations.id', '=', 'session_selections.registration_id')
                ->where('session_selections.session_id', $session->id)
                ->where('session_selections.selection_status', 'selected')
                ->where('registrations.registration_status', 'registered')
                ->pluck('registrations.user_id')
                ->unique()
                ->values()
                ->all();
        }

        // event_based: all registered participants
        return Registration::where('workshop_id', $workshopId)
            ->where('registration_status', 'registered')
            ->pluck('user_id')
            ->unique()
            ->values()
            ->all();
    }
}
