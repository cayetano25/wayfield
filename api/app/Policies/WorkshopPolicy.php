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
