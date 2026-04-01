<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\Actions\CreateLeaderNotificationAction;
use App\Domain\Notifications\Exceptions\LeaderMessagingScopeException;
use App\Domain\Notifications\Exceptions\LeaderMessagingWindowException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateLeaderNotificationRequest;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkshopNotificationController extends Controller
{
    public function __construct(
        private readonly CreateLeaderNotificationAction $createLeaderNotification,
    ) {}

    /**
     * POST /api/v1/workshops/{workshop}/notifications
     *
     * Create a notification. If the authenticated user is a leader, enforces:
     * - session_id required
     * - leader assigned to session
     * - time window valid (in workshop timezone)
     * - recipients scoped to session participants only
     */
    public function store(CreateLeaderNotificationRequest $request, Workshop $workshop): JsonResponse
    {
        $user    = $request->user();
        $session = Session::findOrFail($request->input('session_id'));

        // Verify the session belongs to this workshop
        if ($session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session does not belong to this workshop.'], 422);
        }

        // Authorize: leader must be assigned to this session
        $this->authorize('notification.create-leader', $session);

        try {
            $notification = $this->createLeaderNotification->execute($user, $session, $request->validated());
        } catch (LeaderMessagingScopeException $e) {
            return response()->json(['message' => $e->getMessage()], 403);
        } catch (LeaderMessagingWindowException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message'          => 'Notification created and queued for delivery.',
            'notification_id'  => $notification->id,
            'recipient_count'  => $notification->recipients_count ?? $notification->recipients()->count(),
        ], 201);
    }
}
