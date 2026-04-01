<?php

namespace App\Policies;

use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;

class RosterPolicy
{
    /**
     * Roster access is allowed for:
     * - Org owner, admin, or staff for this workshop's organization
     * - A leader explicitly assigned to THIS session via session_leaders
     *
     * Participants are NEVER allowed to view any roster.
     */
    public function view(User $user, Session $session): bool
    {
        $session->loadMissing('workshop');

        return $this->isOrgStaffOrAbove($user, $session->workshop->organization_id)
            || $this->isLeaderAssignedToSession($user, $session);
    }

    /**
     * Phone number visibility: same as roster view, since phone access is
     * granted to the same set of authorized viewers.
     */
    public function viewPhoneNumbers(User $user, Session $session): bool
    {
        return $this->view($user, $session);
    }

    private function isOrgStaffOrAbove(User $user, int $organizationId): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff'])
            ->exists();
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
}
