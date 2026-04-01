<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\InAppNotificationResource;
use App\Models\NotificationRecipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserNotificationController extends Controller
{
    /**
     * GET /api/v1/me/notifications
     *
     * Return in-app notifications for the authenticated user.
     * Sorted by most recent first, paginated.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $recipients = NotificationRecipient::where('user_id', $user->id)
            ->with('notification.workshop')
            ->whereIn('in_app_status', ['pending', 'delivered', 'read'])
            ->orderByDesc('created_at')
            ->paginate(30);

        // Mark pending in-app notifications as delivered on fetch
        NotificationRecipient::where('user_id', $user->id)
            ->where('in_app_status', 'pending')
            ->update(['in_app_status' => 'delivered']);

        return response()->json([
            'data'  => InAppNotificationResource::collection($recipients->items()),
            'meta'  => [
                'total'        => $recipients->total(),
                'current_page' => $recipients->currentPage(),
                'last_page'    => $recipients->lastPage(),
            ],
        ]);
    }

    /**
     * PATCH /api/v1/me/notifications/{notificationRecipient}/read
     *
     * Mark a specific in-app notification as read.
     */
    public function markRead(Request $request, NotificationRecipient $notificationRecipient): JsonResponse
    {
        // Ensure the authenticated user owns this recipient row
        if ($notificationRecipient->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $notificationRecipient->update([
            'in_app_status' => 'read',
            'read_at'       => now(),
        ]);

        return response()->json(['message' => 'Notification marked as read.']);
    }
}
