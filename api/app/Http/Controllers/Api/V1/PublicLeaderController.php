<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicLeaderResource;
use App\Models\Leader;
use Illuminate\Http\JsonResponse;

class PublicLeaderController extends Controller
{
    /**
     * GET /api/v1/public/leaders/{slug}
     * Public leader profile. Only leaders with at least one active org association are visible.
     */
    public function show(string $slug): JsonResponse
    {
        $leader = Leader::where('slug', $slug)
            ->whereHas('organizationLeaders', fn ($q) => $q->where('status', 'active'))
            ->with([
                'workshopLeaders' => fn ($q) => $q->where('is_confirmed', true)
                    ->with(['workshop' => fn ($wq) => $wq->publiclyVisible()
                        ->with(['defaultLocation', 'categories'])]),
            ])
            ->first();

        if (! $leader) {
            return response()->json(['message' => 'Leader not found.'], 404);
        }

        return response()->json(new PublicLeaderResource($leader));
    }
}
