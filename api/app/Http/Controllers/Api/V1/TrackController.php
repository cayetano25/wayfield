<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\CreateTrackRequest;
use App\Http\Requests\Api\V1\UpdateTrackRequest;
use App\Http\Resources\TrackResource;
use App\Models\Track;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TrackController extends Controller
{
    public function index(Workshop $workshop): AnonymousResourceCollection
    {
        $this->authorize('view', $workshop);

        $tracks = Track::where('workshop_id', $workshop->id)
            ->orderBy('sort_order')
            ->orderBy('title')
            ->get();

        return TrackResource::collection($tracks);
    }

    public function store(CreateTrackRequest $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('create', [Track::class, $workshop]);

        $track = Track::create([
            'workshop_id' => $workshop->id,
            'title' => $request->validated('title'),
            'description' => $request->validated('description'),
            'sort_order' => $request->validated('sort_order', 0) ?? 0,
        ]);

        return response()->json(new TrackResource($track), 201);
    }

    public function update(UpdateTrackRequest $request, Track $track): TrackResource
    {
        $this->authorize('update', $track);

        $track->fill($request->validated())->save();

        return new TrackResource($track->fresh());
    }

    public function destroy(Track $track): JsonResponse
    {
        $this->authorize('delete', $track);

        $track->delete();

        return response()->json(null, 204);
    }
}
