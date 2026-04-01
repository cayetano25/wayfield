<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\UpdateLeaderProfileAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateLeaderProfileRequest;
use App\Http\Resources\LeaderSelfProfileResource;
use App\Http\Resources\OrganizerSessionResource;
use App\Http\Resources\OrganizerWorkshopResource;
use App\Models\Leader;
use App\Models\Session;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LeaderSelfController extends Controller
{
    /**
     * GET /api/v1/leader/profile
     * Return the authenticated user's leader profile.
     */
    public function showProfile(Request $request): JsonResponse
    {
        $leader = Leader::where('user_id', $request->user()->id)->first();

        if (! $leader) {
            return response()->json(['message' => 'No leader profile found for this account.'], 404);
        }

        $this->authorize('viewOwnProfile', $leader);

        return response()->json(new LeaderSelfProfileResource($leader));
    }

    /**
     * PATCH /api/v1/leader/profile
     * Update the authenticated user's leader profile.
     * Profile ownership belongs to the leader — not the organizer.
     */
    public function updateProfile(
        UpdateLeaderProfileRequest $request,
        UpdateLeaderProfileAction $action,
    ): JsonResponse {
        $leader = Leader::where('user_id', $request->user()->id)->first();

        if (! $leader) {
            return response()->json(['message' => 'No leader profile found for this account.'], 404);
        }

        $this->authorize('updateOwnProfile', $leader);

        $leader = $action->execute($leader, $request->user(), $request->validated());

        return response()->json(new LeaderSelfProfileResource($leader));
    }

    /**
     * GET /api/v1/leader/sessions
     * Return sessions assigned to the authenticated leader.
     */
    public function sessions(Request $request): AnonymousResourceCollection
    {
        $leader = Leader::where('user_id', $request->user()->id)->first();

        if (! $leader) {
            return OrganizerSessionResource::collection(collect());
        }

        $sessions = Session::whereHas('sessionLeaders', fn ($q) => $q->where('leader_id', $leader->id))
            ->with(['workshop', 'track', 'location'])
            ->orderBy('start_at')
            ->get();

        return OrganizerSessionResource::collection($sessions);
    }

    /**
     * GET /api/v1/leader/workshops
     * Return workshops the authenticated leader is associated with.
     */
    public function workshops(Request $request): AnonymousResourceCollection
    {
        $leader = Leader::where('user_id', $request->user()->id)->first();

        if (! $leader) {
            return OrganizerWorkshopResource::collection(collect());
        }

        $workshops = $leader->workshops()
            ->with(['organization', 'defaultLocation', 'logistics'])
            ->get();

        return OrganizerWorkshopResource::collection($workshops);
    }
}
