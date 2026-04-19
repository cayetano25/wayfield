<?php

declare(strict_types=1);

namespace App\Services\Auth;

use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;

/**
 * Resolves the effective role(s) a user holds in a given context.
 *
 * All resolution methods query the database directly.
 * Per ROLE_MODEL.md Section 6, role is never read from cache or client input.
 */
final class RoleContextService
{
    // ─── Organisation Context ─────────────────────────────────────────────────

    /**
     * Returns the user's stored role in the given organisation, or null.
     * Valid returns: 'owner' | 'admin' | 'staff' | 'billing_admin' | null
     */
    public function orgRole(User $user, Organization $org): ?string
    {
        return $org->memberRole($user);
    }

    /**
     * Returns true if the user has owner or admin role.
     * Allowed: owner, admin
     * Denied:  staff, billing_admin, non-member
     */
    public function isElevated(User $user, Organization $org): bool
    {
        return $org->isElevatedMember($user);
    }

    /**
     * Returns true if the user has operational access (can touch workshops/sessions).
     * Allowed: owner, admin, staff
     * Denied:  billing_admin, non-member
     */
    public function isOperational(User $user, Organization $org): bool
    {
        return $org->isOperationalMember($user);
    }

    /**
     * Returns true if the user has billing access.
     * Allowed: owner, billing_admin
     * Denied:  admin, staff, non-member
     */
    public function hasBilling(User $user, Organization $org): bool
    {
        return $org->hasBillingAccess($user);
    }

    // ─── Participant Context ───────────────────────────────────────────────────

    /**
     * Returns true if the user is a registered participant in the given workshop.
     * Participant status is derived entirely from registrations — not from any role field.
     * Per ROLE_MODEL.md Section 2.1.
     */
    public function isParticipant(User $user, Workshop $workshop): bool
    {
        return Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->exists();
    }

    /**
     * Returns true if the user is registered AND has selected the given session.
     * Required for self-check-in on session-based workshops.
     * For event-based workshops, registration alone is sufficient.
     */
    public function isParticipantInSession(User $user, Session $session): bool
    {
        $registration = Registration::where('workshop_id', $session->workshop_id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            return false;
        }

        // For event-based workshops, registration alone is sufficient.
        if ($session->workshop->workshop_type === 'event_based') {
            return true;
        }

        // For session-based workshops, a selection row is required.
        return $registration->selections()
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->exists();
    }

    // ─── Leader Context ────────────────────────────────────────────────────────

    /**
     * Returns the Leader record linked to this user, or null.
     * Note: a Leader record exists only when the invitation has been accepted
     * and a users.id has been linked via leaders.user_id.
     */
    public function leaderRecord(User $user): ?Leader
    {
        return Leader::where('user_id', $user->id)->first();
    }

    /**
     * Returns true if the user is an accepted, active leader for the organisation.
     * "Accepted" means leader_invitations.status = 'accepted' for this org.
     * Per ROLE_MODEL.md Section 2.2.
     */
    public function isAcceptedLeader(User $user, Organization $org): bool
    {
        $leader = $this->leaderRecord($user);
        if (! $leader) {
            return false;
        }

        return LeaderInvitation::where('organization_id', $org->id)
            ->where('leader_id', $leader->id)
            ->where('status', 'accepted')
            ->exists();
    }

    /**
     * Returns true if the user is assigned to the given session as a leader
     * with assignment_status = 'accepted'.
     *
     * This is the gate for: roster access, attendance management, leader messaging.
     * Per ROLE_MODEL.md Section 2.2: session_leaders.assignment_status must be 'accepted'.
     */
    public function isAssignedLeaderForSession(User $user, Session $session): bool
    {
        $leader = $this->leaderRecord($user);
        if (! $leader) {
            return false;
        }

        return SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->exists();
    }

    // ─── Cross-Role Scenario Helpers ──────────────────────────────────────────

    /**
     * Scenario D (ROLE_MODEL.md Section 5):
     * If the user has an org-level role, their org permissions take precedence
     * over any leader-scoped restrictions for that org's resources.
     *
     * Returns true if the user is an operational org member OR an accepted
     * assigned leader for the session.
     */
    public function canManageSession(User $user, Session $session): bool
    {
        $org = $session->workshop->organization;

        if ($this->isOperational($user, $org)) {
            return true;
        }

        return $this->isAssignedLeaderForSession($user, $session);
    }

    /**
     * Returns a summary of all contexts for the user.
     * Used by GET /api/v1/me to return the full role picture.
     *
     * @return array{
     *   organization_roles: array<int, array{organization_id: int, role: string}>,
     *   is_leader: bool,
     *   leader_id: int|null
     * }
     */
    public function allContexts(User $user): array
    {
        $orgRoles = $user->organizationUsers()
            ->where('is_active', true)
            ->get(['organization_id', 'role'])
            ->map(fn ($ou) => [
                'organization_id' => $ou->organization_id,
                'role' => $ou->role,
            ])
            ->values()
            ->toArray();

        $leader = $this->leaderRecord($user);

        return [
            'organization_roles' => $orgRoles,
            'is_leader' => $leader !== null,
            'leader_id' => $leader?->id,
        ];
    }
}
