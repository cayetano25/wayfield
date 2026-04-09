<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Organizations\Actions\CreateOrganizationAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateOrganizationRequest;
use App\Http\Requests\Api\V1\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\Organization;
use App\Services\Address\AddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationController extends Controller
{
    public function __construct(private readonly AddressService $addressService) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $organizations = $request->user()
            ->organizations()
            ->wherePivot('is_active', true)
            ->with('address')
            ->get();

        return OrganizationResource::collection($organizations);
    }

    public function store(CreateOrganizationRequest $request, CreateOrganizationAction $action): JsonResponse
    {
        $data = $request->validated();
        $addressData = $data['address'] ?? null;
        unset($data['address']);

        $organization = $action->execute($request->user(), $data);

        if ($addressData !== null) {
            $address = $this->addressService->createFromRequest($addressData);
            $organization->address_id = $address->id;
            $organization->save();
            $organization->setRelation('address', $address);
        }

        return response()->json(new OrganizationResource($organization), 201);
    }

    public function show(Request $request, Organization $organization): OrganizationResource
    {
        $this->authorize('view', $organization);

        $organization->load('address');

        return new OrganizationResource($organization);
    }

    public function update(UpdateOrganizationRequest $request, Organization $organization): OrganizationResource
    {
        $this->authorize('update', $organization);

        $data = $request->validated();
        $addressData = $data['address'] ?? null;
        unset($data['address']);

        $organization->update($data);

        if ($addressData !== null) {
            $organization->loadMissing('address');

            if ($organization->address_id && $organization->address) {
                $this->addressService->updateFromRequest($organization->address, $addressData);
            } else {
                $address = $this->addressService->createFromRequest($addressData);
                $organization->address_id = $address->id;
                $organization->save();
            }
        }

        return new OrganizationResource($organization->fresh()->load('address'));
    }
}
