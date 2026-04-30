<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Seo\Models\WorkshopCategory;
use App\Http\Controllers\Controller;
use App\Models\Leader;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;

class SitemapController extends Controller
{
    /**
     * GET /api/v1/public/sitemap/workshops
     */
    public function workshops(): JsonResponse
    {
        $workshops = Workshop::publiclyVisible()
            ->select(['public_slug', 'updated_at', 'start_date'])
            ->orderBy('start_date')
            ->get()
            ->map(function ($workshop) {
                $start = $workshop->start_date;
                $daysUntil = now()->diffInDays($start, false);

                if ($daysUntil >= 0 && $daysUntil <= 90) {
                    $priority = 0.9;
                } elseif ($daysUntil > 90) {
                    $priority = 0.7;
                } else {
                    $priority = 0.4;
                }

                return [
                    'public_slug' => $workshop->public_slug,
                    'updated_at'  => $workshop->updated_at->toIso8601String(),
                    'start_date'  => $start?->toDateString(),
                    'priority'    => $priority,
                ];
            });

        return response()->json(['data' => $workshops]);
    }

    /**
     * GET /api/v1/public/sitemap/categories
     */
    public function categories(): JsonResponse
    {
        $categories = WorkshopCategory::active()
            ->ordered()
            ->whereHas('workshops', fn ($q) => $q->publiclyVisible())
            ->withCount(['workshops as workshops_count' => fn ($q) => $q->publiclyVisible()])
            ->get(['id', 'slug', 'updated_at'])
            ->map(fn ($cat) => [
                'slug'       => $cat->slug,
                'updated_at' => $cat->updated_at->toIso8601String(),
                'count'      => $cat->workshops_count,
            ]);

        return response()->json(['data' => $categories]);
    }

    /**
     * GET /api/v1/public/sitemap/leaders
     */
    public function leaders(): JsonResponse
    {
        $leaders = Leader::whereNotNull('slug')
            ->whereHas('organizationLeaders', fn ($q) => $q->where('status', 'active'))
            ->get(['slug', 'updated_at'])
            ->map(fn ($leader) => [
                'slug'       => $leader->slug,
                'updated_at' => $leader->updated_at->toIso8601String(),
            ]);

        return response()->json(['data' => $leaders]);
    }
}
