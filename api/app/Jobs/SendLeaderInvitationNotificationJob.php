<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\LeaderInvitation;
use App\Models\User;
use App\Services\Notification\NotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Creates an in-app notification for a leader invitation.
 *
 * Dispatched after the invitation email has been sent.
 * Does NOT interfere with or replace the email flow.
 *
 * Only creates the in-app notification if the invited email address
 * belongs to an existing Wayfield user account. If the invited person
 * has not registered yet, no in-app notification is created — they
 * will receive the email and create their account via the email link.
 */
class SendLeaderInvitationNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [30, 60, 120];

    public function __construct(
        private readonly int $invitationId,
        private readonly string $rawToken,
    ) {}

    public function handle(NotificationService $notificationService): void
    {
        $invitation = LeaderInvitation::with(['organization', 'workshop', 'createdBy'])
            ->find($this->invitationId);

        if ($invitation === null) {
            Log::info('[SendLeaderInvitationNotificationJob] Invitation not found.', [
                'invitation_id' => $this->invitationId,
            ]);

            return;
        }

        $user = User::where('email', $invitation->invited_email)->first();

        if ($user === null) {
            Log::info('[SendLeaderInvitationNotificationJob] No account for email — skipping in-app.', [
                'email' => $invitation->invited_email,
            ]);

            return;
        }

        $inviterName = $invitation->createdBy
            ? trim("{$invitation->createdBy->first_name} {$invitation->createdBy->last_name}")
            : $invitation->organization->name;

        $notificationService->createLeaderInvitationNotification([
            'invitation_id' => $invitation->id,
            'accept_token' => $this->rawToken,
            'decline_token' => $this->rawToken,
            'invited_user_id' => $user->id,
            'organization_id' => $invitation->organization_id,
            'organization_name' => $invitation->organization->name,
            'workshop_title' => $invitation->workshop?->title,
            'inviter_name' => $inviterName,
        ]);

        Log::info('[SendLeaderInvitationNotificationJob] In-app notification created.', [
            'invitation_id' => $this->invitationId,
            'user_id' => $user->id,
        ]);
    }
}
