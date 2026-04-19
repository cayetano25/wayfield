<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\NotificationRecipient;
use App\Services\Notification\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserNotificationController extends Controller
{
    /**
     * GET /api/v1/me/notifications
     *
     * Paginated in-app notifications for the authenticated user.
     * Includes sender identity, session context, and workshop context.
     */
    public function index(Request $request, NotificationService $service): JsonResponse
    {
        $userId = $request->user()->id;

        $paginator = $service->getForUser(userId: $userId, perPage: 20);
        $meta = $service->getMetaForUser($userId);

        $items = $paginator->getCollection()->map(function (NotificationRecipient $r) {
            $n        = $r->notification;
            $workshop = $n->workshop;
            $session  = $n->session;

            return [
                'recipient_id'        => $r->id,
                'notification_id'     => $n->id,
                'title'               => $n->title,
                'message'             => $n->message,
                'notification_type'   => $n->notification_type,
                'notification_category' => $n->notification_category,
                'action_data'         => $n->action_data,
                'is_read'             => $r->isRead(),
                'read_at'             => $r->read_at?->toIso8601String(),
                'created_at'          => $r->created_at->toIso8601String(),
                'is_invitation'       => $n->isInvitation(),
                'is_system'           => $n->isSystem(),
                'sender'              => $this->resolveSender($n),
                'session_context'     => $session ? [
                    'session_id'       => $session->id,
                    'session_title'    => $session->title,
                    'start_at'         => $session->start_at->toIso8601String(),
                    'end_at'           => $session->end_at->toIso8601String(),
                    'workshop_timezone' => $workshop?->timezone,
                ] : null,
                'workshop_context'    => $workshop ? [
                    'workshop_id'    => $workshop->id,
                    'workshop_title' => $workshop->title,
                ] : null,
            ];
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page'      => $paginator->currentPage(),
                'total_pages'       => $paginator->lastPage(),
                'total'             => $paginator->total(),
                'per_page'          => $paginator->perPage(),
                'unread_count'      => $meta['unread_count'],
                'has_urgent_unread' => $meta['has_urgent_unread'],
                'has_leader_unread' => $meta['has_leader_unread'],
            ],
        ]);
    }

    /**
     * Resolves a safe sender object for participant consumption.
     * Leader: first_name, last_name, profile_image_url only — never email/phone.
     * Organizer: organization name only.
     */
    private function resolveSender(\App\Models\Notification $n): array
    {
        if ($n->sender_scope === 'leader') {
            $leader    = $n->createdBy?->leader;
            $createdBy = $n->createdBy;

            $firstName = $leader?->first_name ?? $createdBy?->first_name ?? 'Unknown';
            $lastName  = $leader?->last_name  ?? $createdBy?->last_name  ?? '';
            $fullName  = trim("{$firstName} {$lastName}");

            return [
                'type'              => 'leader',
                'first_name'        => $firstName,
                'last_name'         => $lastName,
                'display_label'     => "{$fullName} · Session Leader",
                'profile_image_url' => $leader?->profile_image_url,
            ];
        }

        // organizer (default) — expose org name only
        $orgName = $n->workshop?->organization?->name ?? 'Unknown Organization';

        return [
            'type'          => 'organizer',
            'name'          => $orgName,
            'display_label' => $orgName,
        ];
    }

    /**
     * GET /api/v1/me/notifications/unread-count
     *
     * Fast COUNT-only endpoint for the bell badge.
     */
    public function unreadCount(Request $request, NotificationService $service): JsonResponse
    {
        return response()->json([
            'unread_count' => $service->getUnreadCount($request->user()->id),
        ]);
    }

    /**
     * PATCH /api/v1/me/notifications/{notificationRecipient}/read
     *
     * Marks a single notification as read. Atomic single-row update.
     */
    public function markRead(Request $request, NotificationRecipient $notificationRecipient): JsonResponse
    {
        if ($notificationRecipient->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $notificationRecipient->markAsRead();

        return response()->json([
            'recipient_id' => $notificationRecipient->id,
            'is_read' => true,
            'read_at' => $notificationRecipient->read_at?->toIso8601String(),
        ]);
    }

    /**
     * POST /api/v1/me/notifications/read-all
     *
     * Marks all unread notifications as read for the authenticated user.
     */
    public function readAll(Request $request, NotificationService $service): JsonResponse
    {
        $count = $service->markAllRead($request->user()->id);

        return response()->json([
            'marked_read' => $count,
            'unread_count' => 0,
        ]);
    }
}
