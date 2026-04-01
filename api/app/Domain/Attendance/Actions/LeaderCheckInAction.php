<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class LeaderCheckInAction
{
    public function execute(User $leader_user, Session $session, User $participant): AttendanceRecord
    {
        // Verify the acting user is a leader assigned to this session
        $this->assertLeaderIsAssigned($leader_user, $session);

        $workshop = $session->workshop;

        $record = AttendanceRecord::updateOrCreate(
            ['session_id' => $session->id, 'user_id' => $participant->id],
            [
                'status'                => 'checked_in',
                'check_in_method'       => 'leader',
                'checked_in_at'         => now(),
                'checked_in_by_user_id' => $leader_user->id,
            ]
        );

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id'   => $leader_user->id,
            'entity_type'     => 'attendance_record',
            'entity_id'       => $record->id,
            'action'          => 'leader_check_in',
            'metadata'        => [
                'session_id'      => $session->id,
                'workshop_id'     => $workshop->id,
                'participant_id'  => $participant->id,
            ],
        ]);

        return $record;
    }

    private function assertLeaderIsAssigned(User $user, Session $session): void
    {
        $leader = Leader::where('user_id', $user->id)->first();

        if (! $leader) {
            throw new AuthorizationException('You are not a leader.');
        }

        $assigned = SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->exists();

        if (! $assigned) {
            throw new AuthorizationException('You are not assigned to this session.');
        }
    }
}
