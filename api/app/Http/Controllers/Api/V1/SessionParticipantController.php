<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Attendance\Actions\OrganizerRemoveParticipantFromSessionAction;
use App\Domain\Sessions\Actions\AssignParticipantToSessionAction;
use App\Domain\Sessions\Actions\RemoveParticipantFromSessionAction;
use App\Domain\Sessions\Exceptions\SessionSelectionException;
use App\Domain\Sessions\Services\EnforceSessionCapacityService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AssignParticipantRequest;
use App\Http\Requests\Api\V1\RemoveParticipantFromSessionRequest;
use App\Http\Resources\SessionParticipantResource;
use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SessionParticipantController extends Controller
{
    public function __construct(
        private readonly AssignParticipantToSessionAction $assignAction,
        private readonly RemoveParticipantFromSessionAction $removeAction,
        private readonly OrganizerRemoveParticipantFromSessionAction $legacyRemoveAction,
    ) {}

    /**
     * GET /api/v1/sessions/{session}/participants
     *
     * Returns all selected participants for a session.
     * Auth: org owner/admin/staff OR assigned leader for this session.
     * Phone numbers shown to authorized callers only.
     */
    public function index(Request $request, Session $session): JsonResponse
    {
        $user = $request->user();

        if (! $this->canViewParticipants($user, $session)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $session->loadMissing('workshop');

        $selections = SessionSelection::where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->with(['registration.user'])
            ->orderBy('created_at')
            ->get();

        $userIds = $selections->map(fn ($s) => $s->registration?->user?->id)->filter()->unique()->values();

        $attendanceByUserId = AttendanceRecord::where('session_id', $session->id)
            ->whereIn('user_id', $userIds)
            ->get()
            ->keyBy('user_id');

        $showPhone = $this->resolvePhoneVisibility($user, $session);

        return response()->json([
            'data' => $selections->map(function ($selection) use ($showPhone, $attendanceByUserId) {
                return (new SessionParticipantResource($selection))
                    ->additional([
                        'show_phone' => $showPhone,
                        'attendance' => $attendanceByUserId,
                    ])
                    ->toArray(request());
            })->values(),
            'total' => $selections->count(),
        ]);
    }

    /**
     * POST /api/v1/sessions/{session}/participants
     *
     * Assign a registered participant to a session.
     * Auth: owner/admin only.
     * Returns 201 on success. Warnings included in body for schedule conflicts.
     * Returns 422 SESSION_AT_CAPACITY when full and force_assign is false.
     */
    public function store(
        AssignParticipantRequest $request,
        Session $session,
    ): JsonResponse {
        $actor = $request->user();

        if (! $this->canAssignParticipant($actor, $session)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validated();
        $participant = User::findOrFail($validated['user_id']);

        // force_assign requires the same owner/admin gate (already cleared above),
        // but we log it explicitly so controllers cannot accept it from staff.
        $forceAssign = $validated['force_assign'];
        if ($forceAssign && ! $this->canForceAssign($actor, $session)) {
            return response()->json(['message' => 'force_assign requires owner or admin role.'], 403);
        }

        try {
            $result = $this->assignAction->assign($session, $participant, $actor, [
                'force_assign' => $forceAssign,
                'assignment_notes' => $validated['assignment_notes'] ?? null,
                'notify_participant' => $validated['notify_participant'],
            ]);
        } catch (SessionSelectionException $e) {
            return $this->sessionSelectionErrorResponse($e);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\App\Domain\Sessions\Exceptions\SessionCapacityExceededException) {
            return response()->json([
                'error' => SessionSelectionException::SESSION_AT_CAPACITY,
                'message' => 'This session is at full capacity.',
            ], 422);
        }

        $session->loadMissing('workshop');
        $showPhone = $this->resolvePhoneVisibility($actor, $session);

        $attendanceByUserId = AttendanceRecord::where('session_id', $session->id)
            ->where('user_id', $participant->id)
            ->get()
            ->keyBy('user_id');

        $resource = (new SessionParticipantResource($result->sessionSelection->load('registration.user')))
            ->additional([
                'show_phone' => $showPhone,
                'attendance' => $attendanceByUserId,
            ])
            ->toArray(request());

        return response()->json([
            'data' => $resource,
            'warnings' => $result->warnings,
        ], 201);
    }

    /**
     * DELETE /api/v1/sessions/{session}/participants/{user}
     *
     * Cancel a participant's session selection. Does NOT delete the row.
     * Auth: owner/admin only.
     */
    public function destroy(
        RemoveParticipantFromSessionRequest $request,
        Session $session,
        User $user,
    ): JsonResponse {
        $participant = $user;
        $actor = $request->user();

        if (! $this->canRemoveParticipant($actor, $session)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validated();

        try {
            $selection = $this->removeAction->remove($session, $participant, $actor, [
                'reason' => $validated['reason'] ?? null,
                'notify_participant' => $validated['notify_participant'],
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $session->loadMissing('workshop');
        $showPhone = $this->resolvePhoneVisibility($actor, $session);

        $attendanceByUserId = AttendanceRecord::where('session_id', $session->id)
            ->where('user_id', $participant->id)
            ->get()
            ->keyBy('user_id');

        $resource = (new SessionParticipantResource($selection->load('registration.user')))
            ->additional([
                'show_phone' => $showPhone,
                'attendance' => $attendanceByUserId,
            ])
            ->toArray(request());

        return response()->json([
            'message' => 'Participant removed from session.',
            'data' => $resource,
        ]);
    }

    // ─── Legacy routes (backward compatibility) ───────────────────────────────

    /**
     * POST /api/v1/workshops/{workshop}/sessions/{session}/participants
     *
     * Legacy endpoint from Phase 14. Delegates to store() logic.
     * Kept for backward compatibility while web admin migrates to the new route.
     */
    public function add(
        Request $request,
        Workshop $workshop,
        Session $session,
    ): JsonResponse {
        $actor = $request->user();

        if (! $workshop->organization->isOperationalMember($actor)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session not found in this workshop.'], 404);
        }

        $request->validate(['user_id' => 'required|integer|exists:users,id']);
        $participant = User::findOrFail($request->integer('user_id'));

        try {
            $result = $this->assignAction->assign($session, $participant, $actor, [
                'force_assign' => false,
                'notify_participant' => false,
            ]);
        } catch (SessionSelectionException $e) {
            return $this->sessionSelectionErrorResponse($e);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\App\Domain\Sessions\Exceptions\SessionCapacityExceededException) {
            return response()->json(['message' => 'This session is at full capacity.'], 422);
        }

        return response()->json([
            'message' => "{$participant->first_name} {$participant->last_name} added to {$session->title}.",
            'warnings' => $result->warnings,
        ]);
    }

    /**
     * DELETE /api/v1/workshops/{workshop}/sessions/{session}/participants/{user}
     *
     * Legacy endpoint from Phase 14. Delegates to destroy() logic.
     */
    public function removeParticipant(
        Request $request,
        Workshop $workshop,
        Session $session,
        User $user,
    ): JsonResponse {
        $actor = $request->user();

        if (! $workshop->organization->isOperationalMember($actor)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session not found in this workshop.'], 404);
        }

        try {
            $this->legacyRemoveAction->execute($actor, $workshop, $session, $user);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Participant removed from session successfully.']);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function sessionSelectionErrorResponse(SessionSelectionException $e): JsonResponse
    {
        return response()->json([
            'error' => $e->getErrorCode(),
            'message' => $e->getMessage(),
            'context' => $e->getContext() ?: null,
        ], 422);
    }

    private function canViewParticipants(User $user, Session $session): bool
    {
        return app(\App\Policies\SessionPolicy::class)->viewParticipants($user, $session);
    }

    private function canAssignParticipant(User $user, Session $session): bool
    {
        return app(\App\Policies\SessionPolicy::class)->assignParticipant($user, $session);
    }

    private function canForceAssign(User $user, Session $session): bool
    {
        return app(\App\Policies\SessionPolicy::class)->forceAssign($user, $session);
    }

    private function canRemoveParticipant(User $user, Session $session): bool
    {
        return app(\App\Policies\SessionPolicy::class)->removeParticipant($user, $session);
    }

    private function resolvePhoneVisibility(User $user, Session $session): bool
    {
        return app(\App\Policies\RosterPolicy::class)->viewPhoneNumbers($user, $session);
    }
}
