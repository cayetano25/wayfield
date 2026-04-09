<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sync\Services\BuildWorkshopSyncPackageService;
use App\Domain\Sync\Services\GenerateSyncVersionService;
use App\Domain\Sync\Services\ReplayOfflineActionsService;
use App\Http\Controllers\Controller;
use App\Models\Leader;
use App\Models\SessionLeader;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OfflineSyncController extends Controller
{
    public function __construct(
        private readonly BuildWorkshopSyncPackageService $packageService,
        private readonly GenerateSyncVersionService $versionService,
        private readonly ReplayOfflineActionsService $replayService,
    ) {}

    /**
     * GET /api/v1/workshops/{workshop}/sync-package
     *
     * Return the offline sync package for this workshop.
     * Role is resolved from the requesting user's relationship to the workshop:
     *   - Confirmed/accepted leader assigned to any session → 'leader'
     *   - Registered participant → 'participant'
     *   - Org member → 'participant' (for preview; they see what participants see)
     *
     * Only registered participants and assigned leaders receive a package.
     * Organizers receive the participant view for simplicity.
     */
    public function syncPackage(Request $request, Workshop $workshop): JsonResponse
    {
        $user = $request->user();

        $this->authorize('sync.download', $workshop);

        $role = $this->resolveRole($user, $workshop);

        $version = $this->versionService->generate($workshop);

        $package = $this->packageService->build($workshop, $role, $user->id);
        $package['version'] = $version;

        return response()->json(['data' => $package]);
    }

    /**
     * GET /api/v1/workshops/{workshop}/sync-version
     *
     * Return just the current version hash. Mobile clients can cheaply poll this
     * to detect whether their cached sync package is stale.
     */
    public function syncVersion(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('sync.download', $workshop);

        $hash = $this->versionService->generate($workshop);

        return response()->json(['version_hash' => $hash]);
    }

    /**
     * POST /api/v1/workshops/{workshop}/offline-actions
     *
     * Accept a batch of offline actions from a reconnecting mobile client.
     * Processing is idempotent — duplicate client_action_uuid values are safe.
     *
     * Request body:
     * {
     *   "actions": [
     *     {
     *       "client_action_uuid": "...",
     *       "action_type": "self_check_in|leader_check_in|attendance_override",
     *       "payload": { "session_id": 1, ... }
     *     }
     *   ]
     * }
     */
    public function replayActions(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('sync.download', $workshop);

        $validated = $request->validate([
            'actions' => ['required', 'array', 'min:1'],
            'actions.*.client_action_uuid' => ['required', 'string', 'max:36'],
            'actions.*.action_type' => ['required', 'string'],
            'actions.*.payload' => ['required', 'array'],
        ]);

        $user = $request->user();
        $results = $this->replayService->replay($user, $workshop, $validated['actions']);

        return response()->json(['results' => $results]);
    }

    /**
     * Determine the role context for building the sync package.
     *
     * Priority:
     *   1. Leader (assigned to at least one session in this workshop, accepted)
     *   2. Participant (registered in this workshop)
     *   3. Organizer/staff → participant view (they have access anyway)
     */
    private function resolveRole(mixed $user, Workshop $workshop): string
    {
        $leader = Leader::where('user_id', $user->id)->first();

        if ($leader) {
            $isAssigned = SessionLeader::join('sessions', 'sessions.id', '=', 'session_leaders.session_id')
                ->where('sessions.workshop_id', $workshop->id)
                ->where('session_leaders.leader_id', $leader->id)
                ->where('session_leaders.assignment_status', 'accepted')
                ->exists();

            if ($isAssigned) {
                return 'leader';
            }
        }

        return 'participant';
    }
}
