<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Leaders\Actions\SelfEnrollAsLeaderAction;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SelfEnrollRequest;
use App\Http\Resources\OrganizerLeaderResource;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Http\JsonResponse;

class LeaderSelfEnrollController extends Controller
{
    /**
     * POST /api/v1/organizations/{organization}/leaders/self-enroll
     *
     * Allows an owner/admin to add themselves as a confirmed leader on the
     * organization, and optionally on a specific workshop within it.
     */
    public function store(SelfEnrollRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('selfEnroll', [Leader::class, $organization]);

        $workshop = $request->validated('workshop_id')
            ? Workshop::findOrFail($request->validated('workshop_id'))
            : null;

        $leader = app(SelfEnrollAsLeaderAction::class)->enroll(
            user: auth()->user(),
            organization: $organization,
            workshop: $workshop,
            profileData: $request->validated(),
        );

        return response()->json([
            'data'    => new OrganizerLeaderResource($leader),
            'message' => 'You have been added as a leader.',
        ], 201);
    }

    /**
     * DELETE /api/v1/organizations/{organization}/leaders/self-enroll
     *
     * Removes the authenticated owner/admin from this organization as a leader
     * (all workshop links within the org are also removed). Does NOT delete the
     * leaders row itself.
     */
    public function destroy(Organization $organization): JsonResponse
    {
        $leader = Leader::where('user_id', auth()->id())->first();

        if (! $leader) {
            return response()->json(['message' => 'You are not enrolled as a leader.'], 404);
        }

        $this->authorize('removeSelfAsLeader', $leader);

        $workshopIds = $organization->workshops()->pluck('id');

        WorkshopLeader::where('leader_id', $leader->id)
            ->whereIn('workshop_id', $workshopIds)
            ->delete();

        OrganizationLeader::where('organization_id', $organization->id)
            ->where('leader_id', $leader->id)
            ->delete();

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id'   => auth()->id(),
            'entity_type'     => 'leader',
            'entity_id'       => $leader->id,
            'action'          => 'owner_removed_self_as_leader',
            'metadata'        => ['organization_id' => $organization->id],
        ]);

        return response()->json(['message' => 'You have been removed as a leader.']);
    }

    /**
     * DELETE /api/v1/workshops/{workshop}/leaders/self
     *
     * Removes the authenticated owner/admin from a single workshop without
     * removing them from the organization.
     */
    public function destroyFromWorkshop(Workshop $workshop): JsonResponse
    {
        $leader = Leader::where('user_id', auth()->id())->first();

        if (! $leader) {
            return response()->json(['message' => 'You are not enrolled as a leader.'], 404);
        }

        $org = $workshop->organization;

        $isMember = auth()->user()->organizationUsers()
            ->where('organization_id', $org->id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();

        if (! $isMember) {
            abort(403);
        }

        WorkshopLeader::where('leader_id', $leader->id)
            ->where('workshop_id', $workshop->id)
            ->delete();

        AuditLogService::record([
            'organization_id' => $org->id,
            'actor_user_id'   => auth()->id(),
            'entity_type'     => 'leader',
            'entity_id'       => $leader->id,
            'action'          => 'owner_removed_self_from_workshop',
            'metadata'        => ['workshop_id' => $workshop->id],
        ]);

        return response()->json(['message' => 'You have been removed from this workshop.']);
    }
}
