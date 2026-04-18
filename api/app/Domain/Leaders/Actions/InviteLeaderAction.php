<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Jobs\SendLeaderInvitationNotificationJob;
use App\Mail\LeaderInvitationMail;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class InviteLeaderAction
{
    /**
     * Send a leader invitation for an organization, optionally scoped to a workshop.
     *
     * The raw token is sent in the email ONLY. The stored value is a sha256 hash.
     */
    public function execute(Organization $organization, User $invitedBy, array $data): LeaderInvitation
    {
        $rawToken = Str::random(64);
        $tokenHash = hash('sha256', $rawToken);

        $invitation = LeaderInvitation::create([
            'organization_id' => $organization->id,
            'workshop_id' => $data['workshop_id'] ?? null,
            'leader_id' => null,
            'invited_email' => $data['invited_email'],
            'invited_first_name' => $data['invited_first_name'] ?? null,
            'invited_last_name' => $data['invited_last_name'] ?? null,
            'status' => 'pending',
            'invitation_token_hash' => $tokenHash,
            'expires_at' => now()->addDays(7),
            'created_by_user_id' => $invitedBy->id,
        ]);

        // Queue the invitation email — raw token goes in the link, never stored
        Mail::to($invitation->invited_email)
            ->queue(new LeaderInvitationMail($invitation, $rawToken));

        // Queue in-app notification for users who already have an account
        SendLeaderInvitationNotificationJob::dispatch(
            $invitation->id,
            $rawToken,
        )->onQueue('default');

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id' => $invitedBy->id,
            'entity_type' => 'leader_invitation',
            'entity_id' => $invitation->id,
            'action' => 'invitation_sent',
            'metadata' => [
                'invited_email' => $invitation->invited_email,
                'workshop_id' => $invitation->workshop_id,
            ],
        ]);

        return $invitation;
    }
}
