<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\AttendanceRecord;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Support\Facades\DB;

class OrganizerRemoveParticipantFromSessionAction
{
    public function execute(User $organizer, Workshop $workshop, Session $session, User $participant): void
    {
        // 1. Find active registration for this workshop.
        $registration = $workshop->registrations()
            ->where('user_id', $participant->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            throw new \InvalidArgumentException(
                'This participant is not registered for this workshop.'
            );
        }

        // 2. Find the active session selection.
        $selection = SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->first();

        if (! $selection) {
            throw new \InvalidArgumentException(
                'This participant is not currently selected for this session.'
            );
        }

        $wasCheckedIn = false;

        // 3–5. Cancel selection and reset attendance in a single transaction.
        DB::transaction(function () use ($selection, $session, $participant, &$wasCheckedIn) {
            $selection->update(['selection_status' => 'canceled']);

            $attendance = AttendanceRecord::where('session_id', $session->id)
                ->where('user_id', $participant->id)
                ->first();

            if ($attendance && $attendance->status === 'checked_in') {
                $wasCheckedIn = true;
                $attendance->update([
                    'status'                => 'not_checked_in',
                    'check_in_method'       => null,
                    'checked_in_at'         => null,
                    'checked_in_by_user_id' => null,
                ]);
            }
        });

        // 6. Write audit log after the transaction commits.
        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id'   => $organizer->id,
            'entity_type'     => 'session_selection',
            'entity_id'       => $selection->id,
            'action'          => 'organizer_removed_participant_from_session',
            'metadata'        => [
                'session_id'             => $session->id,
                'session_title'          => $session->title,
                'participant_id'         => $participant->id,
                'participant_first_name' => $participant->first_name,
                'participant_last_name'  => $participant->last_name,
                'was_checked_in'         => $wasCheckedIn,
            ],
        ]);
    }
}
