<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\LeaderInvitation;
use App\Models\User;

class RescindLeaderInvitationAction
{
    public function execute(LeaderInvitation $invitation, User $actor): LeaderInvitation
    {
        $invitation->update([
            'status' => 'removed',
            'responded_at' => now(),
        ]);

        AuditLogService::record([
            'organization_id' => $invitation->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'leader_invitation',
            'entity_id' => $invitation->id,
            'action' => 'leader_invitation_rescinded',
            'metadata' => [
                'invited_email' => $invitation->invited_email,
                'workshop_id' => $invitation->workshop_id,
                'invitation_id' => $invitation->id,
            ],
        ]);

        return $invitation->fresh();
    }
}
