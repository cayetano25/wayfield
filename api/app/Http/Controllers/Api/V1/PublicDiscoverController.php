<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public Workshop Discovery — no authentication required.
 *
 * Privacy rules enforced here:
 * - join_code is NEVER returned.
 * - meeting_url and virtual credentials are NEVER returned.
 * - No participant data, rosters, or PII.
 * - Leader exposure: first_name, last_name, profile_image_url only.
 */
class PublicDiscoverController extends Controller
{
    /**
     * GET /api/v1/public/discover
     *
     * Returns paginated published workshops open for discovery.
     * No authentication required.
     *
     * Query params:
     *   ?category=photography|education|nature|all  (default: all)
     *   ?page=1
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'category' => ['nullable', 'string', 'in:photography,education,nature,all'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Workshop::query()
            ->where('status', 'published')
            ->where('public_page_enabled', true)
            ->where('end_date', '>=', now()->toDateString())
            ->with([
                'defaultLocation',
                'confirmedLeaders' => fn ($q) => $q->select('leaders.id', 'first_name', 'last_name', 'profile_image_url'),
            ])
            ->withCount([
                'registrations as registered_count' => fn ($q) => $q->where('registration_status', 'registered'),
            ])
            ->orderBy('start_date');

        // Category is a placeholder filter — the schema has no category field yet.
        // Future implementation will filter against a category/tag system.
        // For now we return all and accept the param silently.

        $paginated = $query->paginate(12);

        $workshops = collect($paginated->items())->map(function (Workshop $workshop) {
            $capacityData = $this->resolveCapacity($workshop);

            return [
                'workshop_id' => $workshop->id,
                'public_slug' => $workshop->public_slug,
                'title' => $workshop->title,
                'description_excerpt' => $this->excerpt($workshop->description, 120),
                'start_date' => $workshop->start_date?->toDateString(),
                'end_date' => $workshop->end_date?->toDateString(),
                'timezone' => $workshop->timezone,
                'location' => [
                    'city' => $workshop->defaultLocation?->city,
                    'state_or_region' => $workshop->defaultLocation?->state_or_region,
                    'country_code' => $workshop->defaultLocation?->country_code ?? $workshop->defaultLocation?->country,
                ],
                'capacity_total' => $capacityData['capacity_total'],
                'spots_remaining' => $capacityData['spots_remaining'],
                'spots_status' => $capacityData['spots_status'],
                'leaders' => $workshop->confirmedLeaders->map(fn ($l) => [
                    'first_name' => $l->first_name,
                    'last_name' => $l->last_name,
                    'profile_image_url' => $l->profile_image_url,
                ])->values(),
            ];
        });

        return response()->json([
            'workshops' => $workshops,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'total_pages' => $paginated->lastPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }

    /**
     * Resolves spots availability for a workshop from its published session capacities.
     *
     * If any session has null capacity (unlimited), the workshop is treated as unlimited.
     * Spots are computed from total session capacity vs total session enrollments.
     */
    private function resolveCapacity(Workshop $workshop): array
    {
        $sessions = Session::where('workshop_id', $workshop->id)
            ->where('is_published', true)
            ->get(['id', 'capacity']);

        if ($sessions->isEmpty() || $sessions->contains('capacity', null)) {
            return [
                'capacity_total' => null,
                'spots_remaining' => null,
                'spots_status' => 'available',
            ];
        }

        $totalCapacity = $sessions->sum('capacity');
        $totalEnrolled = SessionSelection::whereIn('session_id', $sessions->pluck('id'))
            ->where('selection_status', 'selected')
            ->count();

        $remaining = max(0, $totalCapacity - $totalEnrolled);

        $status = match (true) {
            $remaining === 0 => 'full',
            $remaining <= 10 => 'limited',
            default => 'available',
        };

        return [
            'capacity_total' => $totalCapacity,
            'spots_remaining' => $remaining,
            'spots_status' => $status,
        ];
    }

    private function excerpt(string $text, int $length): string
    {
        if (mb_strlen($text) <= $length) {
            return $text;
        }

        return mb_substr($text, 0, $length);
    }
}
