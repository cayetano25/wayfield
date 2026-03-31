<?php

namespace App\Policies;

use App\Models\Location;
use App\Models\Organization;
use App\Models\User;

class LocationPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization->id);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    public function update(User $user, Location $location): bool
    {
        if ($location->organization_id === null) {
            return false;
        }
        return $this->isOrganizerOrAbove($user, $location->organization_id);
    }

    public function delete(User $user, Location $location): bool
    {
        if ($location->organization_id === null) {
            return false;
        }
        return $this->isOrganizerOrAbove($user, $location->organization_id);
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
