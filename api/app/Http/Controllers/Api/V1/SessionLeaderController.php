<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\AttachLeaderToSessionAction;
use App\Domain\Leaders\Actions\UpdateSessionLeaderStatusAction;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AttachLeaderToSessionRequest;
use App\Http\Resources\OrganizerLeaderResource;
use App\Http\Resources\SessionLeaderResource;
use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SessionLeaderController extends Controller
{
    /**
     * GET /api/v1/sessions/{session}/leaders
     * List leaders assigned to a session.
     */
    public function index(Session $session): AnonymousResourceCollection
    {
        $this->authorize('view', $session);

        $sessionLeaders = $session->sessionLeaders()->with('leader')->get();

        return SessionLeaderResource::collection($sessionLeaders);
    }

    /**
     * POST /api/v1/sessions/{session}/leaders
     * Assign a leader to a session.
     */
    public function store(
        AttachLeaderToSessionRequest $request,
        Session $session,
        AttachLeaderToSessionAction $action,
    ): JsonResponse {
        $this->authorize('assignToSession', [Leader::class, $session->workshop->organization]);

        $leader = Leader::findOrFail($request->input('leader_id'));

        try {
            $sessionLeader = $action->execute(
                session: $session,
                leader: $leader,
                actor: $request->user(),
                roleLabel: $request->input('role_label'),
                roleInSession: $request->input('role_in_session', 'co_leader'),
                isPrimary: (bool) $request->input('is_primary', false),
                assignmentStatus: $request->input('assignment_status', 'accepted'),
            );
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(
            new SessionLeaderResource($sessionLeader->load('leader')),
            201
        );
    }

    /**
     * PATCH /api/v1/sessions/{session}/leaders/{leader}
     * Update the assignment status of a session leader (accept/decline/remove).
     */
    public function updateStatus(
        Session $session,
        Leader $leader,
        UpdateSessionLeaderStatusAction $action,
    ): JsonResponse {
        $this->authorize('assignToSession', [Leader::class, $session->workshop->organization]);

        $status = request()->input('assignment_status');

        if (! $status) {
            return response()->json(['message' => 'The assignment_status field is required.'], 422);
        }

        try {
            $sessionLeader = $action->execute($session, $leader, request()->user(), $status);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(new SessionLeaderResource($sessionLeader->load('leader')));
    }

    /**
     * DELETE /api/v1/sessions/{session}/leaders/{leader}
     * Remove a leader assignment from a session.
     */
    public function destroy(Session $session, Leader $leader): JsonResponse
    {
        $this->authorize('removeFromSession', [Leader::class, $session->workshop->organization]);

        $sessionLeader = SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->firstOrFail();

        AuditLogService::record([
            'organization_id' => $session->workshop->organization_id,
            'actor_user_id'   => auth()->id(),
            'entity_type'     => 'session_leader',
            'entity_id'       => $sessionLeader->id,
            'action'          => 'leader_removed_from_session',
            'metadata'        => [
                'leader_id'  => $leader->id,
                'session_id' => $session->id,
            ],
        ]);

        $sessionLeader->delete();

        return response()->json(null, 204);
    }
}
