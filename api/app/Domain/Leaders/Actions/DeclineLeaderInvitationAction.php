<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\LeaderInvitation;
use App\Models\NotificationRecipient;
use App\Models\User;

class DeclineLeaderInvitationAction
{
    public function execute(LeaderInvitation $invitation, ?User $actor = null): LeaderInvitation
    {
        $invitation->update([
            'status' => 'declined',
            'responded_at' => now(),
        ]);

        if ($actor !== null) {
            NotificationRecipient::whereHas('notification', function ($q) use ($invitation) {
                $q->where('notification_category', 'invitation')
                    ->whereJsonContains('action_data->invitation_id', $invitation->id);
            })
                ->where('user_id', $actor->id)
                ->where('in_app_status', 'delivered')
                ->update(['in_app_status' => 'read', 'read_at' => now()]);
        }

        AuditLogService::record([
            'organization_id' => $invitation->organization_id,
            'actor_user_id' => $actor?->id,
            'entity_type' => 'leader_invitation',
            'entity_id' => $invitation->id,
            'action' => 'invitation_declined',
            'metadata' => [
                'invited_email' => $invitation->invited_email,
                'workshop_id' => $invitation->workshop_id,
            ],
        ]);

        return $invitation->fresh();
    }
}
