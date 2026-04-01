<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrganizerLeaderResource;
use App\Models\Leader;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkshopLeaderController extends Controller
{
    /**
     * POST /api/v1/workshops/{workshop}/leaders
     * Associate an accepted leader to the workshop for public listing.
     * Only accepted org members (leaders) can be listed as confirmed.
     */
    public function store(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('attachToWorkshop', [Leader::class, $workshop->organization]);

        $request->validate([
            'leader_id'    => ['required', 'integer', 'exists:leaders,id'],
            'is_confirmed' => ['boolean'],
        ]);

        $leader = Leader::findOrFail($request->input('leader_id'));

        // Leader must be an active org member to be listed as confirmed
        $isOrgMember = $leader->organizationLeaders()
            ->where('organization_id', $workshop->organization_id)
            ->where('status', 'active')
            ->exists();

        if (! $isOrgMember) {
            return response()->json([
                'message' => 'Leader is not an active member of this organization.',
            ], 422);
        }

        $confirmed = $request->boolean('is_confirmed', false);

        $workshopLeader = WorkshopLeader::updateOrCreate(
            [
                'workshop_id' => $workshop->id,
                'leader_id'   => $leader->id,
            ],
            ['is_confirmed' => $confirmed]
        );

        return response()->json(new OrganizerLeaderResource($leader), 201);
    }
}
