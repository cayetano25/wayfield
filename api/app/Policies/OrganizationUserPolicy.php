<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;

class OrganizationUserPolicy
{
    public function update(User $user, OrganizationUser $organizationUser): bool
    {
        return $this->isOrganizerOrAbove($user, $organizationUser->organization);
    }

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
