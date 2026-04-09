<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AddOrganizationUserRequest;
use App\Http\Requests\Api\V1\UpdateOrganizationUserRequest;
use App\Http\Resources\OrganizationMemberResource;
use App\Models\Organization;
use App\Models\OrganizationUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationUserController extends Controller
{
    public function index(Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewMembers', $organization);

        $members = $organization->organizationUsers()
            ->with('user')
            ->where('is_active', true)
            ->get();

        return OrganizationMemberResource::collection($members);
    }

    public function store(AddOrganizationUserRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('manageMembers', $organization);

        $member = OrganizationUser::firstOrCreate(
            [
                'organization_id' => $organization->id,
                'user_id' => $request->input('user_id'),
                'role' => $request->input('role'),
            ],
            ['is_active' => true]
        );

        $member->load('user');

        return response()->json(new OrganizationMemberResource($member), 201);
    }

    public function update(UpdateOrganizationUserRequest $request, Organization $organization, OrganizationUser $organizationUser): OrganizationMemberResource
    {
        $this->authorize('manageMembers', $organization);

        abort_if($organizationUser->organization_id !== $organization->id, 404);

        $organizationUser->update($request->validated());

        return new OrganizationMemberResource($organizationUser->load('user')->fresh());
    }
}
