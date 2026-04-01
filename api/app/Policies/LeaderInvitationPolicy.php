<?php

namespace App\Policies;

use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\User;

class LeaderInvitationPolicy
{
    /**
     * Only owner/admin can list invitations.
     */
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
    }

    /**
     * Only owner/admin can create invitations.
     */
    public function create(User $user, Organization $organization): bool
    {
        return $this->isOrganizerOrAbove($user, $organization->id);
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
