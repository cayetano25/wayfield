<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use App\Models\AttendanceRecord;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * External API endpoints — authenticated with API keys (not Sanctum tokens).
 *
 * These routes are accessible to third-party integrations with an API key.
 * All endpoints are strictly read-only and scope-gated.
 *
 * Privacy rules (enforced on every response):
 * - NEVER expose join_code
 * - NEVER expose meeting_url, meeting_id, meeting_passcode, meeting_instructions
 * - NEVER expose participant PII (email, phone_number, names, addresses)
 * - participants:read returns ONLY aggregate counts, never individual records
 */
class ExternalApiController extends Controller
{
    /**
     * GET /api/v1/external/workshops
     *
     * Returns published workshops for the API key's organization.
     * Requires scope: workshops:read
     */
    public function workshops(Request $request): JsonResponse
    {
        $this->requireScope($request, ApiKey::SCOPE_WORKSHOPS_READ);

        $org = $request->apiKeyOrganization;

        $workshops = Workshop::where('organization_id', $org->id)
            ->where('status', 'published')
            ->withCount(['sessions' => fn ($q) => $q->where('is_published', true)])
            ->orderByDesc('start_date')
            ->get()
            ->map(fn (Workshop $w) => [
                'id' => $w->id,
                'title' => $w->title,
                'workshop_type' => $w->workshop_type,
                'start_date' => $w->start_date?->toDateString(),
                'end_date' => $w->end_date?->toDateString(),
                'timezone' => $w->timezone,
                'session_count' => $w->sessions_count,
                'public_slug' => $w->public_slug,
                // join_code is intentionally absent — it grants workshop access
            ]);

        return response()->json(['data' => $workshops]);
    }

    /**
     * GET /api/v1/external/workshops/{workshop}/sessions
     *
     * Returns published sessions for a workshop.
     * Requires scope: sessions:read
     */
    public function sessions(Request $request, Workshop $workshop): JsonResponse
    {
        $this->requireScope($request, ApiKey::SCOPE_SESSIONS_READ);

        $org = $request->apiKeyOrganization;

        if ($workshop->organization_id !== $org->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $sessions = $workshop->sessions()
            ->where('is_published', true)
            ->with(['location'])
            ->withCount(['selections' => fn ($q) => $q->where('selection_status', 'selected')])
            ->orderBy('start_at')
            ->get()
            ->map(fn (Session $s) => [
                'id' => $s->id,
                'title' => $s->title,
                'start_at' => $s->start_at?->toIso8601String(),
                'end_at' => $s->end_at?->toIso8601String(),
                'delivery_type' => $s->delivery_type,
                'capacity' => $s->capacity,
                'confirmed_count' => $s->selections_count,
                'location' => $s->location ? [
                    'city' => $s->location->city,
                    'state_or_region' => $s->location->state_or_region,
                ] : null,
                // meeting_url, meeting_id, meeting_passcode, notes are intentionally absent
            ]);

        return response()->json(['data' => $sessions]);
    }

    /**
     * GET /api/v1/external/workshops/{workshop}/participants/count
     *
     * Returns ONLY aggregate participant counts — never individual records.
     * Requires scope: participants:read
     */
    public function participantCount(Request $request, Workshop $workshop): JsonResponse
    {
        $this->requireScope($request, ApiKey::SCOPE_PARTICIPANTS_READ);

        $org = $request->apiKeyOrganization;

        if ($workshop->organization_id !== $org->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $totalRegistered = $workshop->registrations()
            ->where('registration_status', 'registered')
            ->count();

        $totalCheckedIn = AttendanceRecord::whereHas('session', fn ($q) => $q->where('workshop_id', $workshop->id)
        )->where('status', 'checked_in')->distinct('user_id')->count('user_id');

        $totalNoShow = AttendanceRecord::whereHas('session', fn ($q) => $q->where('workshop_id', $workshop->id)
        )->where('status', 'no_show')->distinct('user_id')->count('user_id');

        return response()->json([
            'total_registered' => $totalRegistered,
            'total_checked_in' => $totalCheckedIn,
            'total_no_show' => $totalNoShow,
            // Never return individual participant records, emails, names, or phone numbers
        ]);
    }

    /**
     * Abort with 403 if the API key does not have the required scope.
     */
    private function requireScope(Request $request, string $scope): void
    {
        if (! in_array($scope, $request->apiKeyScopes ?? [], true)) {
            abort(response()->json([
                'error' => 'insufficient_scope',
                'required' => $scope,
            ], 403));
        }
    }
}
