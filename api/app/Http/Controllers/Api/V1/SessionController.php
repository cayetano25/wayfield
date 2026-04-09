<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sessions\Actions\CreateSessionAction;
use App\Domain\Sessions\Actions\PublishSessionAction;
use App\Domain\Sessions\Actions\UpdateSessionAction;
use App\Domain\Sessions\Exceptions\SessionPublishException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateSessionRequest;
use App\Http\Requests\Api\V1\UpdateSessionRequest;
use App\Http\Resources\OrganizerSessionResource;
use App\Models\Session;
use App\Models\Workshop;
use App\Services\Sessions\SessionLocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SessionController extends Controller
{
    public function __construct(
        private readonly SessionLocationService $locationService
    ) {}

    public function index(Workshop $workshop): AnonymousResourceCollection
    {
        $this->authorize('view', $workshop);

        $sessions = Session::where('workshop_id', $workshop->id)
            ->with(['workshop', 'track', 'location', 'location.address'])
            ->orderBy('start_at')
            ->get();

        return OrganizerSessionResource::collection($sessions);
    }

    public function store(
        CreateSessionRequest $request,
        Workshop $workshop,
        CreateSessionAction $action,
    ): JsonResponse {
        $this->authorize('create', [Session::class, $workshop]);

        $session = $action->execute($workshop, $request->validated());
        $this->locationService->applyLocation($session, $request->validated());

        return response()->json(
            new OrganizerSessionResource($session->fresh(['workshop', 'track', 'location', 'location.address'])),
            201
        );
    }

    public function show(Session $session): OrganizerSessionResource
    {
        $this->authorize('view', $session);

        $session->loadMissing([
            'leaders',
            'workshop',
            'workshop.organization',
            'track',
            'location',
            'location.address',
        ]);

        return new OrganizerSessionResource($session);
    }

    public function update(
        UpdateSessionRequest $request,
        Session $session,
        UpdateSessionAction $action,
    ): OrganizerSessionResource {
        $this->authorize('update', $session);

        $session = $action->execute($session, $request->validated());
        $this->locationService->applyLocation($session, $request->validated());

        return new OrganizerSessionResource($session->fresh(['workshop', 'track', 'location', 'location.address']));
    }

    public function publish(Session $session, PublishSessionAction $action): JsonResponse
    {
        $this->authorize('publish', $session);

        try {
            $session = $action->execute($session);
        } catch (SessionPublishException $e) {
            return response()->json([
                'message' => 'Session cannot be published.',
                'errors' => $e->getErrors(),
            ], 422);
        }

        return response()->json(
            new OrganizerSessionResource($session->load(['workshop', 'track', 'location', 'location.address']))
        );
    }
}
