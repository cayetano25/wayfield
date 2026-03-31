<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateLocationRequest;
use App\Http\Requests\Api\V1\UpdateLocationRequest;
use App\Http\Resources\LocationResource;
use App\Models\Location;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LocationController extends Controller
{
    public function index(Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Location::class, $organization]);

        $locations = Location::where('organization_id', $organization->id)->get();

        return LocationResource::collection($locations);
    }

    public function store(CreateLocationRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Location::class, $organization]);

        $location = Location::create(array_merge(
            $request->validated(),
            ['organization_id' => $organization->id]
        ));

        return response()->json(new LocationResource($location), 201);
    }

    public function update(UpdateLocationRequest $request, Location $location): LocationResource
    {
        $this->authorize('update', $location);

        $location->update($request->validated());

        return new LocationResource($location->fresh());
    }

    public function destroy(Location $location): JsonResponse
    {
        $this->authorize('delete', $location);

        $location->delete();

        return response()->json(null, 204);
    }
}
