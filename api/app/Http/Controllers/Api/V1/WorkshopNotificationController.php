<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\Actions\CreateLeaderNotificationAction;
use App\Domain\Notifications\Actions\CreateOrganizerNotificationAction;
use App\Domain\Notifications\Exceptions\CustomDeliveryNotImplementedException;
use App\Domain\Notifications\Exceptions\LeaderMessagingScopeException;
use App\Domain\Notifications\Exceptions\LeaderMessagingWindowException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateLeaderNotificationRequest;
use App\Http\Requests\Api\V1\CreateOrganizerNotificationRequest;
use App\Http\Resources\NotificationResource;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkshopNotificationController extends Controller
{
    public function __construct(
        private readonly CreateLeaderNotificationAction $createLeaderNotification,
        private readonly CreateOrganizerNotificationAction $createOrganizerNotification,
    ) {}

    /**
     * GET /api/v1/workshops/{workshop}/notifications
     *
     * List notifications for a workshop.
     * Organizers see all; leaders see only their session notifications.
     */
    public function index(Request $request, Workshop $workshop): JsonResponse
    {
        $user = $request->user();

        // Tenant check
        $isOrganizer = $user->organizationUsers()
            ->where('organization_id', $workshop->organization_id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff'])
            ->exists();

        if ($isOrganizer) {
            $notifications = Notification::where('workshop_id', $workshop->id)
                ->withCount('recipients')
                ->orderByDesc('sent_at')
                ->get();

            return response()->json(NotificationResource::collection($notifications));
        }

        // Leader: show only notifications for their assigned sessions
        $leader = Leader::where('user_id', $user->id)->first();

        if ($leader) {
            $assignedSessionIds = $leader->sessionLeaders()
                ->where('assignment_status', 'accepted')
                ->whereHas('session', fn ($q) => $q->where('workshop_id', $workshop->id))
                ->pluck('session_id');

            $notifications = Notification::where('workshop_id', $workshop->id)
                ->where('sender_scope', 'leader')
                ->whereIn('session_id', $assignedSessionIds)
                ->withCount('recipients')
                ->orderByDesc('sent_at')
                ->get();

            return response()->json(NotificationResource::collection($notifications));
        }

        return response()->json(['message' => 'Unauthorized.'], 403);
    }

    /**
     * POST /api/v1/workshops/{workshop}/notifications
     *
     * Route to organizer or leader path based on role.
     *
     * Organizer (owner/admin): requires delivery_scope
     * Leader: requires session_id, subject to time-window enforcement
     */
    public function store(Request $request, Workshop $workshop): JsonResponse
    {
        $user = $request->user();

        $isOrganizer = $user->organizationUsers()
            ->where('organization_id', $workshop->organization_id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();

        if ($isOrganizer) {
            return $this->storeOrganizerNotification($request, $workshop);
        }

        $isLeader = Leader::where('user_id', $user->id)->exists();

        if ($isLeader) {
            return $this->storeLeaderNotification($request, $workshop);
        }

        return response()->json(['message' => 'Unauthorized.'], 403);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function storeOrganizerNotification(Request $request, Workshop $workshop): JsonResponse
    {
        $formRequest = CreateOrganizerNotificationRequest::createFrom($request);
        $formRequest->setContainer(app())->setRedirector(app('redirect'));
        $formRequest->validateResolved();

        $this->authorize('createOrganizer', [Notification::class, $workshop]);

        try {
            $notification = $this->createOrganizerNotification->execute(
                $request->user(),
                $workshop,
                $formRequest->validated()
            );
        } catch (CustomDeliveryNotImplementedException) {
            return response()->json([
                'message' => 'The custom delivery scope is not yet implemented.',
            ], 501);
        }

        return response()->json([
            'message'          => 'Notification created and queued for delivery.',
            'notification_id'  => $notification->id,
            'recipient_count'  => $notification->recipients_count ?? $notification->recipients()->count(),
        ], 201);
    }

    private function storeLeaderNotification(Request $request, Workshop $workshop): JsonResponse
    {
        $formRequest = CreateLeaderNotificationRequest::createFrom($request);
        $formRequest->setContainer(app())->setRedirector(app('redirect'));
        $formRequest->validateResolved();

        $session = Session::findOrFail($formRequest->input('session_id'));

        if ($session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session does not belong to this workshop.'], 422);
        }

        $this->authorize('createLeader', [Notification::class, $session]);

        try {
            $notification = $this->createLeaderNotification->execute(
                $request->user(),
                $session,
                $formRequest->validated()
            );
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
