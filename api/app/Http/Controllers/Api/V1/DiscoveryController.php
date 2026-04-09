<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicWorkshopDiscoveryResource;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public Workshop Discovery — no authentication required.
 *
 * Only published workshops with public_page_enabled = true are returned.
 * Past workshops (end_date < today) are excluded.
 *
 * Privacy enforcement:
 * - join_code MUST NOT appear in any response (triple-checked).
 * - meeting_url and virtual credentials MUST NOT appear.
 * - No participant data, roster, or PII of any kind.
 * - Leader exposure: name, bio, image, website, city, state_or_region only.
 */
class DiscoveryController extends Controller
{
    /**
     * GET /api/v1/discover/workshops
     *
     * Paginated public workshop listing.
     * Max 12 results per page.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'min:2', 'max:200'],
            'location' => ['nullable', 'string', 'max:200'],
            'type' => ['nullable', 'string', 'in:session_based,event_based'],
            'from_date' => ['nullable', 'date_format:Y-m-d'],
            'to_date' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Workshop::query()
            ->where('status', 'published')
            ->where('public_page_enabled', true)
            ->where('end_date', '>=', now()->toDateString())
            ->with(['defaultLocation'])
            ->withCount([
                'confirmedLeaders as confirmed_leaders_count',
                'sessions as published_sessions_count' => fn ($q) => $q->where('is_published', true),
            ]);

        if (! empty($validated['q'])) {
            $term = '%'.$validated['q'].'%';
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', $term)
                    ->orWhere('description', 'like', $term);
            });
        }

        if (! empty($validated['location'])) {
            $loc = '%'.$validated['location'].'%';
            $query->whereHas('defaultLocation', function ($q) use ($loc) {
                $q->where('city', 'like', $loc)
                    ->orWhere('state_or_region', 'like', $loc);
            });
        }

        if (! empty($validated['type'])) {
            $query->where('workshop_type', $validated['type']);
        }

        if (! empty($validated['from_date'])) {
            $query->where('start_date', '>=', $validated['from_date']);
        }

        if (! empty($validated['to_date'])) {
            $query->where('end_date', '<=', $validated['to_date']);
        }

        $paginated = $query->orderBy('start_date')->paginate(12);

        return response()->json([
            'data' => $paginated->items() === []
                ? []
                : PublicWorkshopDiscoveryResource::collection($paginated->items()),
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'total' => $paginated->total(),
                'per_page' => $paginated->perPage(),
            ],
        ]);
    }

    /**
     * GET /api/v1/discover/workshops/{slug}
     *
     * Single workshop detail — includes leaders, sessions, logistics, public_page.
     * Returns 404 for draft, archived, or non-public workshops.
     */
    public function show(string $slug): JsonResponse
    {
        $workshop = Workshop::where('public_slug', $slug)
            ->where('status', 'published')
            ->where('public_page_enabled', true)
            ->with([
                'defaultLocation',
                'confirmedLeaders',
                'sessions' => fn ($q) => $q->where('is_published', true)->with('location'),
                'logistics',
                'publicPage',
            ])
            ->first();

        if (! $workshop) {
            return response()->json(['message' => 'Workshop not found.'], 404);
        }

        $resource = new PublicWorkshopDiscoveryResource($workshop);
        $resource->includeDetail = true;

        return response()->json(['data' => $resource]);
    }
}
