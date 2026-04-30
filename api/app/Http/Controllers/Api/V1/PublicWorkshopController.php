<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicWorkshopListResource;
use App\Http\Resources\PublicWorkshopResource;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicWorkshopController extends Controller
{
    /**
     * GET /api/v1/public/workshops
     * Paginated public workshop listing with optional category/location filters.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Workshop::publiclyVisible()
            ->with([
                'defaultLocation',
                'categories',
                'workshopLeaders' => fn ($q) => $q->where('is_confirmed', true)->with('leader'),
            ])
            ->orderBy('start_date');

        if ($category = $request->query('category')) {
            $query->forCategory((string) $category);
        }

        if ($state = $request->query('state')) {
            $city = $request->query('city') ? (string) $request->query('city') : null;
            $query->forLocation((string) $state, $city);
        }

        $paginated = $query->paginate(24);

        return PublicWorkshopListResource::collection($paginated);
    }

    /**
     * GET /api/v1/public/workshops/{slug}
     * Full public workshop detail by public_slug.
     */
    public function show(string $slug): JsonResponse
    {
        $workshop = Workshop::publiclyVisible()
            ->where('public_slug', $slug)
            ->with([
                'organization',
                'defaultLocation',
                'logistics',
                'publicPage',
                'categories',
                'confirmedLeaders',
                'sessions' => fn ($q) => $q
                    ->where('is_published', true)
                    ->where('participant_visibility', 'visible')
                    ->orderBy('start_at')
                    ->with(['location', 'sessionLeaders.leader']),
                'primaryTaxonomy.category',
                'primaryTaxonomy.subcategory',
                'primaryTaxonomy.specialization',
                'tags.tagGroup',
            ])
            ->first();

        if (! $workshop) {
            return response()->json(['message' => 'Workshop not found.'], 404);
        }

        return response()->json(new PublicWorkshopResource($workshop));
    }
}
