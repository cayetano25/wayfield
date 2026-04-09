<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateOrUpdateLogisticsRequest;
use App\Http\Resources\WorkshopLogisticsResource;
use App\Models\Workshop;
use App\Services\Address\AddressService;
use Illuminate\Http\JsonResponse;

class WorkshopLogisticsController extends Controller
{
    public function __construct(private readonly AddressService $addressService) {}

    public function show(Workshop $workshop): JsonResponse
    {
        $this->authorize('view', $workshop);

        $logistics = $workshop->logistics;

        if (! $logistics) {
            return response()->json(null, 404);
        }

        $logistics->load('hotelAddress');

        return response()->json(new WorkshopLogisticsResource($logistics));
    }

    public function upsert(CreateOrUpdateLogisticsRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('manageLogistics', $workshop);

        $data = $request->validated();

        // hotel_address can be a string (legacy) or array (structured address).
        $hotelAddressInput = $data['hotel_address'] ?? null;
        $hotelAddressData = null;

        if (is_array($hotelAddressInput)) {
            // Structured address object — process separately, do not store as varchar
            $hotelAddressData = $hotelAddressInput;
            unset($data['hotel_address']);
        }
        // If it's a string (or null), it passes through as the legacy hotel_address varchar

        $logistics = $workshop->logistics()->updateOrCreate(
            ['workshop_id' => $workshop->id],
            $data
        );

        if ($hotelAddressData !== null) {
            $logistics->load('hotelAddress');

            if ($logistics->hotel_address_id && $logistics->hotelAddress) {
                $this->addressService->updateFromRequest($logistics->hotelAddress, $hotelAddressData);
            } else {
                $address = $this->addressService->createFromRequest($hotelAddressData);
                $logistics->hotel_address_id = $address->id;
                $logistics->save();
                $logistics->setRelation('hotelAddress', $address);
            }
        }

        $logistics->load('hotelAddress');

        return response()->json(new WorkshopLogisticsResource($logistics), 200);
    }
}
