<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Exceptions\AttendanceEligibilityException;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;

class SelfCheckInAction
{
    public function execute(User $user, Session $session): AttendanceRecord
    {
        $workshop = $session->workshop;

        // 1. Verify active registration
        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            throw new AttendanceEligibilityException(
                'You must be registered for this workshop to check in.'
            );
        }

        // 2. For session_based workshops, require an active session selection
        if ($workshop->isSessionBased()) {
            $hasSelection = $registration->selections()
                ->where('session_id', $session->id)
                ->where('selection_status', 'selected')
                ->exists();

            if (! $hasSelection) {
                throw new AttendanceEligibilityException(
                    'You must have selected this session to check in.'
                );
            }
        }

        // 3. Upsert the attendance record (idempotent — re-checking in is a no-op)
        $record = AttendanceRecord::updateOrCreate(
            ['session_id' => $session->id, 'user_id' => $user->id],
            [
                'status' => 'checked_in',
                'check_in_method' => 'self',
                'checked_in_at' => now(),
                'checked_in_by_user_id' => null,
            ]
        );

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $user->id,
            'entity_type' => 'attendance_record',
            'entity_id' => $record->id,
            'action' => 'self_check_in',
            'metadata' => [
                'session_id' => $session->id,
                'workshop_id' => $workshop->id,
            ],
        ]);

        return $record;
    }
}
