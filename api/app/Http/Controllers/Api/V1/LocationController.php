<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateLocationRequest;
use App\Http\Requests\Api\V1\UpdateLocationRequest;
use App\Http\Resources\LocationResource;
use App\Models\Location;
use App\Models\Organization;
use App\Services\Address\AddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LocationController extends Controller
{
    public function __construct(private readonly AddressService $addressService) {}

    public function index(Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Location::class, $organization]);

        $locations = Location::where('organization_id', $organization->id)
            ->with('address')
            ->get();

        return LocationResource::collection($locations);
    }

    public function store(CreateLocationRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Location::class, $organization]);

        $data = array_merge(
            $request->validated(),
            ['organization_id' => $organization->id]
        );

        // Strip the nested address object before creating the location row
        $addressData = $data['address'] ?? null;
        unset($data['address']);

        $location = Location::create($data);

        if ($addressData !== null) {
            $address = $this->addressService->createFromRequest($addressData);
            $location->address_id = $address->id;
            $location->save();
            $location->setRelation('address', $address);
        }

        return response()->json(new LocationResource($location->load('address')), 201);
    }

    public function update(UpdateLocationRequest $request, Location $location): LocationResource
    {
        $this->authorize('update', $location);

        $data = $request->validated();

        $addressData = $data['address'] ?? null;
        unset($data['address']);

        $location->update($data);

        if ($addressData !== null) {
            if ($location->address_id && $location->address) {
                $this->addressService->updateFromRequest($location->address, $addressData);
            } else {
                $address = $this->addressService->createFromRequest($addressData);
                $location->address_id = $address->id;
                $location->save();
            }
        }

        return new LocationResource($location->fresh()->load('address'));
    }

    public function destroy(Location $location): JsonResponse
    {
        $this->authorize('delete', $location);

        $location->delete();

        return response()->json(null, 204);
    }
}
