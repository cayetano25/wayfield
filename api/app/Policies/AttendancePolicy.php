<?php

namespace App\Policies;

use App\Models\Leader;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;

class AttendancePolicy
{
    /**
     * Participant self-check-in: user must be actively registered to the workshop.
     * Eligibility (session selection for session_based) is enforced in the action.
     */
    public function selfCheckIn(User $user, Session $session): bool
    {
        return Registration::where('workshop_id', $session->workshop_id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->exists();
    }

    /**
     * Leader check-in and no-show: user must be a leader explicitly assigned to this session.
     */
    public function leaderManage(User $user, Session $session): bool
    {
        return $this->isLeaderAssignedToSession($user, $session);
    }

    /**
     * Organizer view / override: org owner, admin, or staff can manage attendance for any session.
     */
    public function organizerManage(User $user, Session $session): bool
    {
        return $this->isOrgStaffOrAbove($user, $session->workshop->organization_id);
    }

    private function isLeaderAssignedToSession(User $user, Session $session): bool
    {
        $leader = Leader::where('user_id', $user->id)->first();

        if (! $leader) {
            return false;
        }

        return SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->exists();
    }

    private function isOrgStaffOrAbove(User $user, int $organizationId): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff'])
            ->exists();
    }
}
