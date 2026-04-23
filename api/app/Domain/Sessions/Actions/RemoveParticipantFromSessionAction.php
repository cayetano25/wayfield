<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Notifications\Services\QueueNotificationDeliveryAction;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\NotificationRecipient;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class RemoveParticipantFromSessionAction
{
    public function __construct(
        private readonly QueueNotificationDeliveryAction $queueDelivery,
    ) {}

    /**
     * Cancel a participant's session selection (does not delete the row).
     *
     * @param array{
     *   reason?: string|null,
     *   notify_participant?: bool,
     * } $options
     *
     * @throws \InvalidArgumentException
     */
    public function remove(
        Session $session,
        User $participant,
        User $removedBy,
        array $options = [],
    ): SessionSelection {
        $reason = $options['reason'] ?? null;
        $notifyParticipant = (bool) ($options['notify_participant'] ?? false);

        $session->loadMissing('workshop');
        $workshop = $session->workshop;

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $participant->id)
            ->first();

        if (! $registration) {
            throw new \InvalidArgumentException(
                'Participant has no registration for the workshop this session belongs to.'
            );
        }

        $selection = SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->first();

        if (! $selection) {
            throw new \InvalidArgumentException(
                'Participant does not have an active selection for this session.'
            );
        }

        $previousStatus = $selection->selection_status;

        DB::transaction(function () use ($selection) {
            $selection->update(['selection_status' => 'canceled']);
        });

        // ── Audit log ─────────────────────────────────────────────────────────
        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $removedBy->id,
            'entity_type' => 'session_selection',
            'entity_id' => $selection->id,
            'action' => 'organizer_removed',
            'metadata' => [
                'session_id' => $session->id,
                'session_title' => $session->title,
                'participant_id' => $participant->id,
                'participant_first_name' => $participant->first_name,
                'participant_last_name' => $participant->last_name,
                'previous_selection_status' => $previousStatus,
                'reason' => $reason,
            ],
        ]);

        // ── Participant notification (queued) ─────────────────────────────────
        if ($notifyParticipant) {
            $this->queueParticipantNotification($session, $participant, $removedBy, $workshop);
        }

        return $selection->fresh();
    }

    private function queueParticipantNotification(
        Session $session,
        User $participant,
        User $removedBy,
        \App\Models\Workshop $workshop,
    ): void {
        try {
            $notification = Notification::create([
                'organization_id' => $workshop->organization_id,
                'workshop_id' => $workshop->id,
                'created_by_user_id' => $removedBy->id,
                'title' => 'You have been removed from a session',
                'message' => "You have been removed from \"{$session->title}\" by {$removedBy->first_name} {$removedBy->last_name}.",
                'notification_type' => 'informational',
                'sender_scope' => 'organizer',
                'delivery_scope' => 'session_participants',
                'session_id' => $session->id,
                'sent_at' => Carbon::now(),
            ]);

            $prefs = NotificationPreference::where('user_id', $participant->id)->first();
            $recipient = NotificationRecipient::create([
                'notification_id' => $notification->id,
                'user_id' => $participant->id,
                'email_status' => ($prefs?->email_notifications ?? true) ? 'pending' : 'skipped',
                'push_status' => ($prefs?->push_notifications ?? true) ? 'pending' : 'skipped',
                'in_app_status' => 'pending',
            ]);

            $this->queueDelivery->dispatch($notification, collect([$recipient]));
        } catch (\Throwable) {
            // Notification failure must never fail the removal operation.
        }
    }
}
