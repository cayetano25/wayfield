<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;

class AttachLeaderToSessionAction
{
    /**
     * Assign a leader to a session via session_leaders.
     * Roster access, phone visibility, and messaging scope only apply once
     * assignment_status = 'accepted'.
     * The leader must have an accepted invitation for the organization before assignment.
     *
     * @param  string  $roleInSession  One of: primary_leader, co_leader, panelist, moderator, assistant
     * @param  bool  $isPrimary  Whether this leader is the primary/lead instructor
     *
     * @throws \InvalidArgumentException if leader is not active in the organization
     */
    public function execute(
        Session $session,
        Leader $leader,
        User $actor,
        ?string $roleLabel = null,
        string $roleInSession = 'co_leader',
        bool $isPrimary = false,
        string $assignmentStatus = 'accepted',
    ): SessionLeader {
        $workshop = $session->workshop;

        // Validate role_in_session
        $validRoles = ['primary_leader', 'co_leader', 'panelist', 'moderator', 'assistant'];
        if (! in_array($roleInSession, $validRoles)) {
            throw new \InvalidArgumentException(
                "Invalid role_in_session value '{$roleInSession}'. Must be one of: ".implode(', ', $validRoles)
            );
        }

        // Leader must belong to the organization (active)
        $isOrgMember = $leader->organizationLeaders()
            ->where('organization_id', $workshop->organization_id)
            ->where('status', 'active')
            ->exists();

        if (! $isOrgMember) {
            throw new \InvalidArgumentException(
                'Leader is not an active member of this organization and cannot be assigned to sessions.'
            );
        }

        // If designating as primary, clear any existing primary flags first
        if ($isPrimary) {
            SessionLeader::where('session_id', $session->id)
                ->where('is_primary', true)
                ->update(['is_primary' => false]);
        }

        $sessionLeader = SessionLeader::updateOrCreate(
            [
                'session_id' => $session->id,
                'leader_id' => $leader->id,
            ],
            [
                'role_label' => $roleLabel,
                'role_in_session' => $roleInSession,
                'assignment_status' => $assignmentStatus,
                'is_primary' => $isPrimary,
            ]
        );

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'session_leader',
            'entity_id' => $sessionLeader->id,
            'action' => $sessionLeader->wasRecentlyCreated
                ? 'leader_assigned_to_session'
                : 'leader_session_assignment_updated',
            'metadata' => [
                'leader_id' => $leader->id,
                'session_id' => $session->id,
                'role_label' => $roleLabel,
                'role_in_session' => $roleInSession,
                'assignment_status' => $assignmentStatus,
                'is_primary' => $isPrimary,
            ],
        ]);

        return $sessionLeader;
    }
}
