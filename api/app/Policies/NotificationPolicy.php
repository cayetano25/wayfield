<?php

namespace App\Policies;

use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;

class NotificationPolicy
{
    /**
     * Organizer (owner/admin) can send notifications scoped to any delivery target
     * within their organization's workshop.
     */
    public function createOrganizer(User $user, Workshop $workshop): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $workshop->organization_id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    /**
     * Leader can create a notification only for a session they are explicitly assigned to.
     * Time-window enforcement is handled in EnforceLeaderMessagingRulesService, not here.
     */
    public function createLeader(User $user, Session $session): bool
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
