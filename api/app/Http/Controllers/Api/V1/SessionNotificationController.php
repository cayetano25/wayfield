<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\Actions\CreateLeaderNotificationAction;
use App\Exceptions\LeaderMessagingDeniedException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateSessionLeaderNotificationRequest;
use App\Models\Notification;
use App\Models\Session;
use Illuminate\Http\JsonResponse;

class SessionNotificationController extends Controller
{
    public function __construct(
        private readonly CreateLeaderNotificationAction $createLeaderNotification,
    ) {}

    /**
     * POST /api/v1/sessions/{session}/notifications
     *
     * Create a leader notification for a session's enrolled participants.
     *
     * Only the assigned leader for this session may call this endpoint.
     * The backend always sets: sender_scope='leader', delivery_scope='session_participants',
     * session_id, organization_id, and workshop_id — none of these are accepted from the request.
     */
    public function store(CreateSessionLeaderNotificationRequest $request, Session $session): JsonResponse
    {
        // Allowed: assigned leader for this session (assignment_status = 'accepted')
        $this->authorize('createLeader', [Notification::class, $session]);

        try {
            $notification = $this->createLeaderNotification->execute(
                $request->user(),
                $session,
                $request->validated()
            );
        } catch (LeaderMessagingDeniedException $e) {
            // messaging_denied = "not assigned to this session" (policy already gated on leader profile)
            // messaging_window / no_participants = business rule violations
            // plan_required = plan gate (403 — feature not available on this plan)
            $code422 = ['messaging_window', 'no_participants', 'messaging_denied'];
            $status = in_array($e->getErrorCode(), $code422, true) ? 422 : 403;

            return response()->json($e->getResponseData(), $status);
        }

        return response()->json([
            'message' => 'Notification created and queued for delivery.',
            'notification_id' => $notification->id,
            'recipient_count' => $notification->recipients_count ?? $notification->recipients()->count(),
        ], 201);
    }
}
