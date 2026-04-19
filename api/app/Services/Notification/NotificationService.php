<?php

declare(strict_types=1);

namespace App\Services\Notification;

use App\Models\Notification;
use App\Models\NotificationRecipient;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * Creates in-app notification records for system events.
 *
 * Called from jobs, not from controllers. Does NOT handle email or push.
 * The existing notification creation flow for organizer/leader messaging
 * is NOT changed by this service.
 */
final class NotificationService
{
    /**
     * Creates a notification and a notification_recipients row for a leader invitation.
     *
     * The action_data payload gives the frontend everything it needs to render
     * Accept/Decline buttons without extra API calls.
     *
     * @param array{
     *   invitation_id:     int,
     *   accept_token:      string,
     *   decline_token:     string,
     *   invited_user_id:   int,
     *   organization_id:   int,
     *   organization_name: string,
     *   workshop_title:    string|null,
     *   inviter_name:      string,
     * } $data
     */
    public function createLeaderInvitationNotification(array $data): Notification
    {
        return DB::transaction(function () use ($data) {
            $notification = Notification::create([
                'organization_id' => $data['organization_id'],
                'workshop_id' => null,
                'created_by_user_id' => null,
                'title' => 'Workshop Leader Invitation',
                'message' => $this->buildInvitationMessage(
                    $data['organization_name'],
                    $data['workshop_title'],
                    $data['inviter_name']
                ),
                'notification_type' => 'informational',
                'notification_category' => 'invitation',
                'sender_scope' => 'organizer',
                'delivery_scope' => 'custom',
                'action_data' => [
                    'invitation_id' => $data['invitation_id'],
                    'accept_token' => $data['accept_token'],
                    'decline_token' => $data['decline_token'],
                    'organization_name' => $data['organization_name'],
                    'workshop_title' => $data['workshop_title'],
                    'inviter_name' => $data['inviter_name'],
                    'accept_url' => "/leader-invitations/{$data['accept_token']}/accept",
                    'decline_url' => "/leader-invitations/{$data['decline_token']}/decline",
                ],
                'sent_at' => now(),
            ]);

            NotificationRecipient::create([
                'notification_id' => $notification->id,
                'user_id' => $data['invited_user_id'],
                'in_app_status' => 'delivered',
                'read_at' => null,
            ]);

            return $notification;
        });
    }

    /**
     * Returns the unread in-app notification count for a user.
     * Single COUNT query — used for the bell badge.
     */
    public function getUnreadCount(int $userId): int
    {
        return NotificationRecipient::where('user_id', $userId)
            ->whereIn('in_app_status', ['pending', 'delivered'])
            ->whereNull('read_at')
            ->count();
    }

    /**
     * Returns paginated in-app notifications for a user, most recent first.
     * Eager-loads sender identity, session, and workshop context to avoid N+1.
     *
     * @return LengthAwarePaginator
     */
    public function getForUser(int $userId, int $perPage = 20)
    {
        return NotificationRecipient::with([
            'notification.createdBy.leader',
            'notification.session:id,title,start_at,end_at',
            'notification.workshop:id,title,timezone,organization_id',
            'notification.workshop.organization:id,name',
        ])
            ->where('user_id', $userId)
            ->whereIn('in_app_status', ['pending', 'delivered', 'read'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Returns unread-count meta for the bell and notification list header.
     * Single aggregate JOIN query — no N+1.
     */
    public function getMetaForUser(int $userId): array
    {
        $row = NotificationRecipient::query()
            ->join('notifications', 'notification_recipients.notification_id', '=', 'notifications.id')
            ->where('notification_recipients.user_id', $userId)
            ->whereIn('notification_recipients.in_app_status', ['pending', 'delivered'])
            ->whereNull('notification_recipients.read_at')
            ->selectRaw('
                COUNT(*) as unread_count,
                SUM(notifications.notification_type = ?) as urgent_count,
                SUM(notifications.sender_scope = ?) as leader_count
            ', ['urgent', 'leader'])
            ->first();

        return [
            'unread_count'      => (int) ($row->unread_count ?? 0),
            'has_urgent_unread' => (int) ($row->urgent_count ?? 0) > 0,
            'has_leader_unread' => (int) ($row->leader_count ?? 0) > 0,
        ];
    }

    /**
     * Marks all unread notifications as read for a user.
     * Returns the number of rows updated.
     */
    public function markAllRead(int $userId): int
    {
        return NotificationRecipient::where('user_id', $userId)
            ->whereIn('in_app_status', ['pending', 'delivered'])
            ->whereNull('read_at')
            ->update([
                'in_app_status' => 'read',
                'read_at' => now(),
            ]);
    }

    private function buildInvitationMessage(
        string $orgName,
        ?string $workshopTitle,
        string $inviterName
    ): string {
        if ($workshopTitle) {
            return "{$inviterName} at {$orgName} has invited you to lead sessions for \"{$workshopTitle}\".";
        }

        return "{$inviterName} at {$orgName} has invited you to join as a leader.";
    }
}
