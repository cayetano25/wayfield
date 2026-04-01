<?php

namespace App\Policies;

use App\Models\Leader;
use App\Models\Organization;
use App\Models\User;

class LeaderPolicy
{
    /**
     * Active org members can view leaders in their organization.
     */
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization->id);
    }

    /**
     * Only owner/admin can invite leaders.
     */
    public function invite(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    /**
     * Only owner/admin can attach leaders to workshops.
     */
    public function attachToWorkshop(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    /**
     * Only owner/admin can assign leaders to sessions.
     */
    public function assignToSession(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    /**
     * Only owner/admin can remove leader session assignments.
     */
    public function removeFromSession(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    /**
     * A leader can update their own profile.
     * The leader record must be linked to the authenticated user's account.
     */
    public function updateOwnProfile(User $user, Leader $leader): bool
    {
        return $leader->user_id === $user->id;
    }

    /**
     * A leader can view their own profile if linked.
     */
    public function viewOwnProfile(User $user, Leader $leader): bool
    {
        return $leader->user_id === $user->id;
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
