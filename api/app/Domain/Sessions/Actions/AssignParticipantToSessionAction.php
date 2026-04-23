<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Notifications\Services\QueueNotificationDeliveryAction;
use App\Domain\Sessions\Exceptions\SessionSelectionException;
use App\Domain\Sessions\Services\DetectSelectionConflictService;
use App\Domain\Sessions\Services\EnforceSessionCapacityService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\AttendanceRecord;
use App\Models\Notification;
use App\Models\NotificationPreference;
use App\Models\NotificationRecipient;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AssignParticipantToSessionAction
{
    public function __construct(
        private readonly EnforceSessionCapacityService $capacityService,
        private readonly DetectSelectionConflictService $conflictService,
        private readonly QueueNotificationDeliveryAction $queueDelivery,
    ) {}

    /**
     * Assign a participant to a session on behalf of an organizer.
     *
     * @param array{
     *   force_assign?: bool,
     *   assignment_notes?: string|null,
     *   notify_participant?: bool,
     * } $options
     *
     * @throws SessionSelectionException
     */
    public function assign(
        Session $session,
        User $participant,
        User $assignedBy,
        array $options = [],
    ): AssignParticipantResult {
        $forceAssign = (bool) ($options['force_assign'] ?? false);
        $assignmentNotes = $options['assignment_notes'] ?? null;
        $notifyParticipant = (bool) ($options['notify_participant'] ?? false);

        $session->loadMissing('workshop');
        $workshop = $session->workshop;

        // ── Validate registration ─────────────────────────────────────────────
        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $participant->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            throw new \InvalidArgumentException(
                'Participant is not registered for the workshop this session belongs to.'
            );
        }

        // ── Validate session state ────────────────────────────────────────────
        if ($session->publication_status !== 'published') {
            throw new SessionSelectionException(
                SessionSelectionException::SESSION_NOT_PUBLISHED,
                'Cannot assign participants to an unpublished session.',
            );
        }

        if (! in_array($session->enrollment_mode, ['organizer_assign_only', 'self_select'], true)) {
            throw new SessionSelectionException(
                SessionSelectionException::SESSION_NOT_SELF_SELECTABLE,
                "Session enrollment_mode '{$session->enrollment_mode}' does not allow organizer assignment.",
            );
        }

        // ── Capacity check (transactional) ────────────────────────────────────
        // Schedule conflict: warn but do not block.
        $warnings = [];

        $selection = DB::transaction(function () use (
            $registration, $session, $participant, $assignedBy, $assignmentNotes,
            $forceAssign, &$warnings,
        ) {
            // Check for schedule conflict — warning, not error.
            try {
                $this->conflictService->checkForConflict($registration, $session);
            } catch (\App\Domain\Sessions\Exceptions\SessionConflictException $e) {
                $warnings[] = [
                    'code' => 'WARN_SCHEDULE_CONFLICT',
                    'message' => $e->getMessage(),
                    'conflict_session_id' => $e->getConflictingSessionId(),
                ];
            }

            // Capacity check with SELECT…FOR UPDATE unless force_assign is set.
            // force_assign bypasses capacity — the controller must gate this with
            // the forceAssign policy before setting force_assign=true.
            if (! $forceAssign) {
                $this->capacityService->enforceWithLock($session);
            }

            // Upsert: update an existing canceled/waitlisted row instead of inserting.
            $existing = SessionSelection::where('registration_id', $registration->id)
                ->where('session_id', $session->id)
                ->first();

            $now = Carbon::now();

            if ($existing) {
                $existing->update([
                    'selection_status' => 'selected',
                    'assignment_source' => 'organizer_assigned',
                    'assigned_by_user_id' => $assignedBy->id,
                    'assigned_at' => $now,
                    'assignment_notes' => $assignmentNotes,
                ]);

                $selection = $existing->fresh();
            } else {
                $selection = SessionSelection::create([
                    'registration_id' => $registration->id,
                    'session_id' => $session->id,
                    'selection_status' => 'selected',
                    'assignment_source' => 'organizer_assigned',
                    'assigned_by_user_id' => $assignedBy->id,
                    'assigned_at' => $now,
                    'assignment_notes' => $assignmentNotes,
                ]);
            }

            // Ensure an attendance record exists (not_checked_in) so rosters are complete.
            AttendanceRecord::firstOrCreate(
                ['session_id' => $session->id, 'user_id' => $participant->id],
                ['status' => 'not_checked_in'],
            );

            return $selection;
        });

        // ── Audit log (after transaction commits) ─────────────────────────────
        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $assignedBy->id,
            'entity_type' => 'session_selection',
            'entity_id' => $selection->id,
            'action' => 'organizer_assigned',
            'metadata' => [
                'session_id' => $session->id,
                'session_title' => $session->title,
                'participant_id' => $participant->id,
                'participant_first_name' => $participant->first_name,
                'participant_last_name' => $participant->last_name,
                'force_assign' => $forceAssign,
                'had_schedule_conflict' => count(array_filter($warnings, fn ($w) => $w['code'] === 'WARN_SCHEDULE_CONFLICT')) > 0,
            ],
        ]);

        // ── Participant notification (queued) ─────────────────────────────────
        if ($notifyParticipant) {
            $this->queueParticipantNotification($session, $participant, $assignedBy, $workshop);
        }

        return new AssignParticipantResult(
            success: true,
            sessionSelection: $selection,
            warnings: $warnings,
        );
    }

    private function queueParticipantNotification(
        Session $session,
        User $participant,
        User $assignedBy,
        \App\Models\Workshop $workshop,
    ): void {
        try {
            $notification = Notification::create([
                'organization_id' => $workshop->organization_id,
                'workshop_id' => $workshop->id,
                'created_by_user_id' => $assignedBy->id,
                'title' => 'You have been added to a session',
                'message' => "You have been added to \"{$session->title}\" by {$assignedBy->first_name} {$assignedBy->last_name}.",
                'notification_type' => 'informational',
                'sender_scope' => 'organizer',
                'delivery_scope' => 'session_participants',
                'session_id' => $session->id,
                'sent_at' => Carbon::now(),
            ]);

            // Create the recipient record directly — we know the single target user.
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
            // Notification failure must never fail the assignment operation.
        }
    }
}
