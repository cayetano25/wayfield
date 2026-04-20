<?php

declare(strict_types=1);

namespace App\Domain\Notifications\Actions;

use App\Domain\Notifications\Services\QueueNotificationDeliveryAction;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\OrganizationInvitation;

class CreateOrgInvitationNotificationAction
{
    private const ROLE_LABELS = [
        'admin' => 'an Administrator',
        'staff' => 'a Staff Member',
        'billing_admin' => 'a Billing Administrator',
    ];

    public function __construct(
        private readonly QueueNotificationDeliveryAction $queueDelivery,
    ) {}

    /**
     * Create an in-app notification for an existing-user invitee.
     *
     * If the invitation has no user_id (invitee has no account yet) this is a
     * no-op — email is the only channel until they register.
     *
     * @param  string  $rawToken  The raw token included in the email link. Stored in
     *                            action_data so the web layer can render Accept/Decline
     *                            buttons without a separate API round-trip.
     */
    public function execute(OrganizationInvitation $invitation, string $rawToken): void
    {
        if ($invitation->user_id === null) {
            return;
        }

        $invitation->loadMissing('organization');
        $orgName = $invitation->organization->name;
        $roleLabel = self::ROLE_LABELS[$invitation->role] ?? ucfirst($invitation->role);

        $notification = Notification::create([
            'organization_id' => $invitation->organization_id,
            'workshop_id' => null,
            'created_by_user_id' => $invitation->created_by_user_id,
            'title' => "You've been invited to join {$orgName}",
            'message' => "You have been invited to join {$orgName} as {$roleLabel}. Check your email to accept or decline.",
            'notification_type' => 'informational',
            'notification_category' => 'invitation',
            'sender_scope' => 'organizer',
            'delivery_scope' => 'custom',
            'session_id' => null,
            'sent_at' => now(),
            'action_data' => [
                'type' => 'org_invitation',
                'invitation_token' => $rawToken,
                'organization_name' => $orgName,
                'role' => $invitation->role,
            ],
        ]);

        $recipient = NotificationRecipient::create([
            'notification_id' => $notification->id,
            'user_id' => $invitation->user_id,
            'in_app_status' => 'delivered',
            'email_status' => 'skipped',
            'push_status' => 'pending',
        ]);

        $this->queueDelivery->dispatch($notification, collect([$recipient]));
    }
}
