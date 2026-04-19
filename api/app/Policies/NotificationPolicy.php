<?php

namespace App\Policies;

use App\Models\Leader;
use App\Models\Session;
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
     * Gate: the user must have a leader profile.
     *
     * Session-specific assignment is enforced in EnforceLeaderMessagingRulesService
     * (returns 422), which runs after this gate. Separating the checks produces clear
     * HTTP semantics: 403 = not a leader, 422 = leader but business rule violated.
     *
     * Allowed: any user with a linked leader profile (user_id on leaders table)
     * Denied: users with no leader profile at all
     */
    public function createLeader(User $user, Session $session): bool
    {
        return Leader::where('user_id', $user->id)->exists();
    }
}
