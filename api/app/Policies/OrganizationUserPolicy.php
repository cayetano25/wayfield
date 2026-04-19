<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;

class OrganizationUserPolicy
{
    // Allowed: owner, admin
    // Denied: staff, billing_admin
    public function update(User $user, OrganizationUser $organizationUser): bool
    {
        return $this->isOrganizerOrAbove($user, $organizationUser->organization);
    }

    // Allowed: owner, admin
    // Denied: staff, billing_admin
    public function delete(User $user, OrganizationUser $organizationUser): bool
    {
        return $this->isOrganizerOrAbove($user, $organizationUser->organization);
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
