<?php

namespace App\Policies;

use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
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

    /**
     * Assign a participant to a session.
     * Allowed: owner, admin.
     * Denied:  staff, billing_admin.
     */
    public function assignParticipant(User $user, Session $session): bool
    {
        $session->loadMissing('workshop');

        return $this->isOrganizerOrAbove($user, $session->workshop->organization_id);
    }

    /**
     * Force-assign a participant over capacity.
     * Allowed: owner, admin only — same as assignParticipant.
     * The policy gate is separate so controllers can check it independently.
     */
    public function forceAssign(User $user, Session $session): bool
    {
        $session->loadMissing('workshop');

        return $this->isOrganizerOrAbove($user, $session->workshop->organization_id);
    }

    /**
     * Remove a participant from a session.
     * Allowed: owner, admin.
     * Denied:  staff, billing_admin.
     */
    public function removeParticipant(User $user, Session $session): bool
    {
        $session->loadMissing('workshop');

        return $this->isOrganizerOrAbove($user, $session->workshop->organization_id);
    }

    /**
     * View session participant list.
     * Allowed: owner, admin, staff, OR an assigned leader for this session.
     * Denied:  billing_admin, participants.
     */
    public function viewParticipants(User $user, Session $session): bool
    {
        $session->loadMissing('workshop');

        return $this->isOrgStaffOrAbove($user, $session->workshop->organization_id)
            || $this->isLeaderAssignedToSession($user, $session);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function isMember(User $user, int $organizationId): bool
    {
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->exists();
    }

    private function isOrganizerOrAbove(User $user, int $organizationId): bool
    {
        // Allowed: owner, admin. Denied: staff, billing_admin.
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    private function isOrgStaffOrAbove(User $user, int $organizationId): bool
    {
        // Allowed: owner, admin, staff. Denied: billing_admin.
        return $user->organizationUsers()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff'])
            ->exists();
    }

    private function isLeaderAssignedToSession(User $user, Session $session): bool
    {
        $leader = Leader::where('user_id', $user->id)->first();

        if (! $leader) {
            return false;
        }

        return SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->exists();
    }
}
