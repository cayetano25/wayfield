<?php

namespace App\Policies;

use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;

class SessionPolicy
{
    /**
     * Any active org member can view sessions.
     */
    public function view(User $user, Session $session): bool
    {
        return $this->isMember($user, $session->workshop->organization_id);
    }

    /**
     * Only owner/admin can create sessions.
     */
    public function create(User $user, Workshop $workshop): bool
    {
        return $this->isOrganizerOrAbove($user, $workshop->organization_id);
    }

    /**
     * Only owner/admin can update sessions.
     */
    public function update(User $user, Session $session): bool
    {
        return $this->isOrganizerOrAbove($user, $session->workshop->organization_id);
    }

    /**
     * Only owner/admin can publish sessions.
     */
    public function publish(User $user, Session $session): bool
    {
        return $this->isOrganizerOrAbove($user, $session->workshop->organization_id);
    }

    /**
     * Only owner/admin can delete sessions.
     */
    public function delete(User $user, Session $session): bool
    {
        return $this->isOrganizerOrAbove($user, $session->workshop->organization_id);
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
