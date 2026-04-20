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
     * Owner, admin, and staff can view the member list.
     * Allowed: owner, admin, staff
     * Denied: billing_admin
     */
    public function viewMembers(User $user, Organization $organization): bool
    {
        return $organization->organizationUsers()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff'])
            ->exists();
    }

    /**
     * Only owner/admin can manage members (add, update roles).
     */
    public function manageMembers(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization);
    }

    /**
     * Only owner can change member roles.
     * Allowed: owner
     * Denied: admin, staff, billing_admin
     */
    public function changeRole(User $user, Organization $organization): bool
    {
        return $this->isOwner($user, $organization);
    }

    /**
     * Owner or admin can remove members (admin restricted to staff only — enforced in controller).
     * Allowed: owner, admin
     * Denied: staff, billing_admin
     */
    public function removeMembers(User $user, Organization $organization): bool
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

    private function isOwner(User $user, Organization $organization): bool
    {
        return $organization->organizationUsers()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->where('role', 'owner')
            ->exists();
    }
}
