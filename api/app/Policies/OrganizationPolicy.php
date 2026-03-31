<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

class OrganizationPolicy
{
    /**
     * Any active member can view their organization.
     */
    public function view(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    /**
     * Only owner/admin can update organization metadata.
     */
    public function update(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization);
    }

    /**
     * Any active member can view the member list.
     */
    public function viewMembers(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    /**
     * Only owner/admin can manage members (add, update roles).
     */
    public function manageMembers(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization);
    }

    private function isMember(User $user, Organization $organization): bool
    {
        return $organization->organizationUsers()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->exists();
    }

    private function isOrganizerOrAbove(User $user, Organization $organization): bool
    {
        return $organization->organizationUsers()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }
}
