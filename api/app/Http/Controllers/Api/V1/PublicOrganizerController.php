<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicOrganizerResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;

class PublicOrganizerController extends Controller
{
    /**
     * GET /api/v1/public/organizers/{slug}
     * Public organizer profile with their publicly visible workshops.
     */
    public function show(string $slug): JsonResponse
    {
        $organization = Organization::where('slug', $slug)
            ->where('status', 'active')
            ->first();

        if (! $organization) {
            return response()->json(['message' => 'Organizer not found.'], 404);
        }

        $organization->setRelation(
            'publicWorkshops',
            $organization->workshops()
                ->publiclyVisible()
                ->with(['defaultLocation', 'categories'])
                ->orderBy('start_date')
                ->limit(12)
                ->get()
        );

        return response()->json(new PublicOrganizerResource($organization));
    }
}
