<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Exceptions\AttendanceEligibilityException;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\AttendanceRecord;
use App\Models\Session;
use App\Models\User;

class RevertAttendanceAction
{
    public function execute(User $actor, Session $session, User $participant): AttendanceRecord
    {
        $record = AttendanceRecord::where('session_id', $session->id)
            ->where('user_id', $participant->id)
            ->first();

        if (! $record || ! in_array($record->status, ['checked_in', 'no_show'], true)) {
            throw new AttendanceEligibilityException('Attendance status cannot be reverted.');
        }

        $record->update([
            'status' => 'not_checked_in',
            'check_in_method' => null,
            'checked_in_at' => null,
            'checked_in_by_user_id' => null,
        ]);

        $workshop = $session->workshop;

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'attendance_record',
            'entity_id' => $record->id,
            'action' => 'attendance_reverted',
            'metadata' => [
                'session_id' => $session->id,
                'actor_user_id' => $actor->id,
            ],
        ]);

        return $record->fresh();
    }
}
