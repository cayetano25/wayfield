<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;

class WorkshopPolicy
{
    /**
     * Any active org member can view a workshop.
     */
    public function view(User $user, Workshop $workshop): bool
    {
        return $this->isMember($user, $workshop->organization_id);
    }

    /**
     * Only owner/admin can create workshops.
     */
    public function create(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    /**
     * Only owner/admin can update workshops.
     */
    public function update(User $user, Workshop $workshop): bool
    {
        return $this->isOrganizerOrAbove($user, $workshop->organization_id);
    }

    /**
     * Only owner/admin can publish workshops.
     */
    public function publish(User $user, Workshop $workshop): bool
    {
        return $this->isOrganizerOrAbove($user, $workshop->organization_id);
    }

    /**
     * Only owner/admin can archive workshops.
     */
    public function archive(User $user, Workshop $workshop): bool
    {
        return $this->isOrganizerOrAbove($user, $workshop->organization_id);
    }

    /**
     * Only owner/admin can manage logistics.
     */
    public function manageLogistics(User $user, Workshop $workshop): bool
    {
        return $this->isOrganizerOrAbove($user, $workshop->organization_id);
    }

    /**
     * Owner, admin, and staff may view the workshop's participant list.
     */
    public function viewParticipants(User $user, Workshop $workshop): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $workshop->organization_id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff'])
            ->exists();
    }

    /**
     * Sync package access: registered participants, assigned leaders, and org members.
     */
    public function syncDownload(User $user, Workshop $workshop): bool
    {
        // Org member always has access
        if ($this->isMember($user, $workshop->organization_id)) {
            return true;
        }

        // Registered participant
        $isRegistered = \App\Models\Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->exists();

        if ($isRegistered) {
            return true;
        }

        // Leader assigned to any session in this workshop
        $leader = \App\Models\Leader::where('user_id', $user->id)->first();
        if ($leader) {
            return \App\Models\SessionLeader::join('sessions', 'sessions.id', '=', 'session_leaders.session_id')
                ->where('sessions.workshop_id', $workshop->id)
                ->where('session_leaders.leader_id', $leader->id)
                ->where('session_leaders.assignment_status', 'accepted')
                ->exists();
        }

        return false;
    }

    private function isMember(User $user, int $organizationId): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->exists();
    }

    private function isOrganizerOrAbove(User $user, int $organizationId): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }
}
