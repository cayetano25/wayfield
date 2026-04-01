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
     * Roster access, phone visibility, and messaging scope all derive from this assignment.
     * The leader must have an accepted invitation for the organization before assignment.
     *
     * @throws \InvalidArgumentException if leader is not active in the organization
     */
    public function execute(Session $session, Leader $leader, User $actor, ?string $roleLabel = null): SessionLeader
    {
        $workshop = $session->workshop;

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

        $sessionLeader = SessionLeader::firstOrCreate(
            [
                'session_id' => $session->id,
                'leader_id'  => $leader->id,
            ],
            ['role_label' => $roleLabel]
        );

        if (! $sessionLeader->wasRecentlyCreated && $roleLabel !== null) {
            $sessionLeader->update(['role_label' => $roleLabel]);
        }

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id'   => $actor->id,
            'entity_type'     => 'session_leader',
            'entity_id'       => $sessionLeader->id,
            'action'          => 'leader_assigned_to_session',
            'metadata'        => [
                'leader_id'  => $leader->id,
                'session_id' => $session->id,
                'role_label' => $roleLabel,
            ],
        ]);

        return $sessionLeader;
    }
}
