<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Organizations\Actions\CreateOrganizationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateOrganizationRequest;
use App\Http\Requests\Api\V1\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $organizations = $request->user()
            ->organizations()
            ->wherePivot('is_active', true)
            ->get();

        return OrganizationResource::collection($organizations);
    }

    public function store(CreateOrganizationRequest $request, CreateOrganizationAction $action): JsonResponse
    {
        $organization = $action->execute($request->user(), $request->validated());

        return response()->json(new OrganizationResource($organization), 201);
    }

    public function show(Request $request, Organization $organization): OrganizationResource
    {
        $this->authorize('view', $organization);

        return new OrganizationResource($organization);
    }

    public function update(UpdateOrganizationRequest $request, Organization $organization): OrganizationResource
    {
        $this->authorize('update', $organization);

        $organization->update($request->validated());

        return new OrganizationResource($organization->fresh());
    }
}
