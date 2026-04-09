<?php

namespace App\Policies;

use App\Models\Track;
use App\Models\User;
use App\Models\Workshop;

class TrackPolicy
{
    // Allowed: owner, admin, staff, billing_admin (any active org member)
    public function view(User $user, Track $track): bool
    {
        return $this->isMember($user, $track->workshop->organization_id);
    }

    // Allowed: owner, admin
    // Denied: staff, billing_admin
    public function create(User $user, Workshop $workshop): bool
    {
        return $this->isOrganizerOrAbove($user, $workshop->organization_id);
    }

    // Allowed: owner, admin
    // Denied: staff, billing_admin
    public function update(User $user, Track $track): bool
    {
        return $this->isOrganizerOrAbove($user, $track->workshop->organization_id);
    }

    // Allowed: owner, admin
    // Denied: staff, billing_admin
    public function delete(User $user, Track $track): bool
    {
        return $this->isOrganizerOrAbove($user, $track->workshop->organization_id);
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
