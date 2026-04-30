<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\UpdateLeaderProfileAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateLeaderProfileRequest;
use App\Http\Resources\LeaderSelfProfileResource;
use App\Http\Resources\LeaderSessionResource;
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
     * Returns the same leader_profile shape as GET /api/v1/me for seamless client-side state updates.
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

        return response()->json([
            'leader_profile' => [
                'id'                => $leader->id,
                'bio'               => $leader->bio,
                'website_url'       => $leader->website_url,
                'social_instagram'  => $leader->social_instagram,
                'social_twitter'    => $leader->social_twitter,
                'phone_number'      => $leader->phone_number,
                'address_line_1'    => $leader->address_line_1,
                'address_line_2'    => $leader->address_line_2,
                'city'              => $leader->city,
                'state_or_region'   => $leader->state_or_region,
                'postal_code'       => $leader->postal_code,
                'country'           => $leader->country,
                'profile_image_url' => $leader->profile_image_url,
            ],
        ]);
    }

    /**
     * GET /api/v1/leader/sessions
     * Return sessions assigned to the authenticated leader with roster and messaging context.
     */
    public function sessions(Request $request): AnonymousResourceCollection
    {
        $leader = Leader::where('user_id', $request->user()->id)->first();

        if (! $leader) {
            return LeaderSessionResource::collection(collect());
        }

        $sessions = Session::whereHas('sessionLeaders', fn ($q) => $q->where('leader_id', $leader->id)->where('assignment_status', 'accepted'))
            ->with([
                'workshop',
                'workshop.defaultLocation',
                'workshop.logistics',
                'workshop.registrations' => fn ($q) => $q->where('registration_status', 'registered')->with('user'),
                'location',
                'selections' => fn ($q) => $q->where('selection_status', 'selected')->with('registration.user'),
                'attendanceRecords',
            ])
            ->orderBy('start_at')
            ->get();

        return LeaderSessionResource::collection($sessions);
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
