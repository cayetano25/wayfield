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
     */
    public function index(Request $request, NotificationService $service): JsonResponse
    {
        $paginator = $service->getForUser(
            userId: $request->user()->id,
            perPage: 20,
        );

        $items = $paginator->getCollection()->map(function (NotificationRecipient $r) {
            $n = $r->notification;

            return [
                'recipient_id' => $r->id,
                'notification_id' => $n->id,
                'title' => $n->title,
                'message' => $n->message,
                'notification_type' => $n->notification_type,
                'notification_category' => $n->notification_category,
                'action_data' => $n->action_data,
                'is_read' => $r->isRead(),
                'read_at' => $r->read_at?->toIso8601String(),
                'created_at' => $r->created_at->toIso8601String(),
                'is_invitation' => $n->isInvitation(),
                'is_system' => $n->isSystem(),
            ];
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'total_pages' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
            ],
        ]);
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
