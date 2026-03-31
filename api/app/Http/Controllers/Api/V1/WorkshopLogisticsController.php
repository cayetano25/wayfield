<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateOrUpdateLogisticsRequest;
use App\Http\Resources\WorkshopLogisticsResource;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class WorkshopLogisticsController extends Controller
{
    public function show(Workshop $workshop): JsonResponse
    {
        $this->authorize('view', $workshop);

        $logistics = $workshop->logistics;

        if (! $logistics) {
            return response()->json(null, 404);
        }

        return response()->json(new WorkshopLogisticsResource($logistics));
    }

    public function upsert(CreateOrUpdateLogisticsRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('manageLogistics', $workshop);

        $logistics = $workshop->logistics()->updateOrCreate(
            ['workshop_id' => $workshop->id],
            $request->validated()
        );

        return response()->json(new WorkshopLogisticsResource($logistics), 200);
    }
}
