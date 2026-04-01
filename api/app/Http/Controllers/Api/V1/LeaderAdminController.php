<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\InviteLeaderAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\InviteLeaderRequest;
use App\Http\Resources\LeaderInvitationResource;
use App\Http\Resources\OrganizerLeaderResource;
use App\Models\Leader;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LeaderAdminController extends Controller
{
    /**
     * GET /api/v1/organizations/{organization}/leaders
     * List all leaders associated with this organization.
     */
    public function index(Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Leader::class, $organization]);

        $leaders = $organization->leaders()
            ->with('organizationLeaders')
            ->get();

        return OrganizerLeaderResource::collection($leaders);
    }

    /**
     * POST /api/v1/organizations/{organization}/leaders/invitations
     * Invite a leader to the organization (and optionally a workshop).
     */
    public function invite(
        InviteLeaderRequest $request,
        Organization $organization,
        InviteLeaderAction $action,
    ): JsonResponse {
        $this->authorize('invite', [Leader::class, $organization]);

        $invitation = $action->execute(
            $organization,
            $request->user(),
            $request->validated(),
        );

        return response()->json(
            new LeaderInvitationResource($invitation->load('organization')),
            201
        );
    }
}
