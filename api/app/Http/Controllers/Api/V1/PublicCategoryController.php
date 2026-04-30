<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Seo\Models\WorkshopCategory;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicCategoryResource;
use App\Http\Resources\PublicWorkshopListResource;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class PublicCategoryController extends Controller
{
    /**
     * GET /api/v1/public/categories
     * Active categories that have at least one publicly visible workshop.
     */
    public function index(): JsonResponse
    {
        $categories = WorkshopCategory::active()
            ->ordered()
            ->withCount(['workshops as workshops_count' => fn ($q) => $q->publiclyVisible()])
            ->having('workshops_count', '>', 0)
            ->get();

        return response()->json(PublicCategoryResource::collection($categories));
    }

    /**
     * GET /api/v1/public/categories/{categorySlug}
     * Category detail + paginated publicly visible workshops.
     */
    public function show(string $categorySlug): JsonResponse
    {
        $category = WorkshopCategory::where('slug', $categorySlug)
            ->where('is_active', true)
            ->first();

        if (! $category) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        $workshops = Workshop::publiclyVisible()
            ->forCategory($categorySlug)
            ->with(['defaultLocation', 'categories'])
            ->orderBy('start_date')
            ->paginate(24);

        return response()->json([
            'category'  => new PublicCategoryResource($category),
            'workshops' => PublicWorkshopListResource::collection($workshops),
        ]);
    }

    /**
     * GET /api/v1/public/categories/{categorySlug}/locations/{locationSlug}
     * Workshops filtered by category AND location (state_or_region).
     * locationSlug: "new-york" → "New York"
     */
    public function byLocation(string $categorySlug, string $locationSlug): JsonResponse
    {
        $category = WorkshopCategory::where('slug', $categorySlug)
            ->where('is_active', true)
            ->first();

        if (! $category) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        $stateOrRegion = Str::title(str_replace('-', ' ', $locationSlug));

        $workshops = Workshop::publiclyVisible()
            ->forCategory($categorySlug)
            ->forLocation($stateOrRegion)
            ->with(['defaultLocation', 'categories'])
            ->orderBy('start_date')
            ->paginate(24);

        return response()->json([
            'category'      => new PublicCategoryResource($category),
            'location'      => $stateOrRegion,
            'location_slug' => $locationSlug,
            'workshops'     => PublicWorkshopListResource::collection($workshops),
        ]);
    }
}
