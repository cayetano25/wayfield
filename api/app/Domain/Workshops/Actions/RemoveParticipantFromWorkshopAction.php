<?php

namespace App\Domain\Workshops\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Support\Facades\DB;

class RemoveParticipantFromWorkshopAction
{
    public function execute(
        Workshop $workshop,
        Registration $registration,
        User $actor,
        ?string $removalReason = null,
    ): void {
        DB::transaction(function () use ($workshop, $registration, $actor, $removalReason) {
            $sessionIds = $workshop->sessions()->pluck('id');

            // Record which sessions had active selections before canceling.
            $sessionsAffected = SessionSelection::where('registration_id', $registration->id)
                ->whereIn('session_id', $sessionIds)
                ->where('selection_status', 'selected')
                ->pluck('session_id')
                ->toArray();

            $registration->update([
                'registration_status' => 'removed',
                'removed_at' => now(),
                'removed_by_user_id' => $actor->id,
                'removal_reason' => $removalReason,
            ]);

            // Cancel all session selections for this registration.
            SessionSelection::where('registration_id', $registration->id)
                ->whereIn('session_id', $sessionIds)
                ->update(['selection_status' => 'canceled']);

            // Mark not-yet-checked-in attendance records as no_show.
            // Checked-in records are preserved as historical fact.
            AttendanceRecord::whereIn('session_id', $sessionIds)
                ->where('user_id', $registration->user_id)
                ->where('status', 'not_checked_in')
                ->update(['status' => 'no_show']);

            AuditLogService::record([
                'organization_id' => $workshop->organization_id,
                'actor_user_id' => $actor->id,
                'entity_type' => 'registration',
                'entity_id' => $registration->id,
                'action' => 'participant_removed',
                'metadata' => [
                    'removed_user_id' => $registration->user_id,
                    'workshop_id' => $workshop->id,
                    'workshop_title' => $workshop->title,
                    'removal_reason' => $removalReason,
                    'sessions_affected' => $sessionsAffected,
                ],
            ]);
        });
    }
}
