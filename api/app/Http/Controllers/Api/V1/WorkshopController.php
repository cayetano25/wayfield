<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Exceptions\PlanLimitExceededException;
use App\Domain\Workshops\Actions\ArchiveWorkshopAction;
use App\Domain\Workshops\Actions\CreateWorkshopAction;
use App\Domain\Workshops\Actions\PublishWorkshopAction;
use App\Domain\Workshops\Actions\UpdateWorkshopAction;
use App\Domain\Workshops\Exceptions\WorkshopPublishException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateWorkshopRequest;
use App\Http\Requests\Api\V1\UpdateWorkshopRequest;
use App\Http\Resources\OrganizerWorkshopResource;
use App\Models\Organization;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WorkshopController extends Controller
{
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('view', $organization);

        $query = Workshop::where('organization_id', $organization->id)
            ->with(['defaultLocation', 'logistics', 'publicPage']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('workshop_type')) {
            $query->where('workshop_type', $request->input('workshop_type'));
        }

        if ($request->filled('start_from')) {
            $query->whereDate('start_date', '>=', $request->input('start_from'));
        }

        if ($request->filled('start_until')) {
            $query->whereDate('start_date', '<=', $request->input('start_until'));
        }

        return OrganizerWorkshopResource::collection(
            $query->orderBy('start_date', 'desc')->get()
        );
    }

    public function store(
        CreateWorkshopRequest $request,
        Organization $organization,
        CreateWorkshopAction $action,
    ): JsonResponse {
        $this->authorize('create', [Workshop::class, $organization]);

        try {
            $workshop = $action->execute($organization, $request->validated());
        } catch (PlanLimitExceededException $e) {
            return response()->json([
                'error' => 'plan_limit_exceeded',
                'message' => $e->getMessage(),
                'limit_key' => $e->limitKey,
                'current' => $e->current,
                'max' => $e->max,
                'required_plan' => $e->requiredPlan,
            ], 403);
        }

        return response()->json(
            new OrganizerWorkshopResource($workshop->load(['defaultLocation', 'logistics', 'publicPage'])),
            201
        );
    }

    public function show(Workshop $workshop): OrganizerWorkshopResource
    {
        $this->authorize('view', $workshop);

        return new OrganizerWorkshopResource(
            $workshop->load(['defaultLocation', 'logistics', 'publicPage', 'confirmedLeaders'])
        );
    }

    public function update(
        UpdateWorkshopRequest $request,
        Workshop $workshop,
        UpdateWorkshopAction $action,
    ): OrganizerWorkshopResource|JsonResponse {
        $this->authorize('update', $workshop);

        try {
            $workshop = $action->execute($workshop, $request->validated());
        } catch (\LogicException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new OrganizerWorkshopResource(
            $workshop->load(['defaultLocation', 'logistics', 'publicPage'])
        );
    }

    public function publish(Workshop $workshop, PublishWorkshopAction $action): JsonResponse
    {
        $this->authorize('publish', $workshop);

        try {
            $workshop = $action->execute($workshop);
        } catch (WorkshopPublishException $e) {
            return response()->json([
                'message' => 'Workshop cannot be published.',
                'errors' => $e->getErrors(),
            ], 422);
        }

        return response()->json(
            new OrganizerWorkshopResource($workshop->load(['defaultLocation', 'logistics', 'publicPage']))
        );
    }

    public function archive(Workshop $workshop, ArchiveWorkshopAction $action): OrganizerWorkshopResource
    {
        $this->authorize('archive', $workshop);

        $workshop = $action->execute($workshop);

        return new OrganizerWorkshopResource(
            $workshop->load(['defaultLocation', 'logistics', 'publicPage'])
        );
    }
}
