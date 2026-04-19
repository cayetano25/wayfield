<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class JoinCodePreviewController extends Controller
{
    /**
     * GET /api/v1/join/{join_code}
     *
     * Pre-join lookup: resolve a join code to workshop preview data.
     * Auth is optional — works for authenticated and unauthenticated requests.
     * Always returns HTTP 200 to prevent join code enumeration.
     *
     * FORBIDDEN — never add these to the response:
     * - join_code (the raw code from workshops table)
     * - meeting_url, meeting_id, meeting_passcode
     * - participant rosters or phone numbers
     * - leader email, phone, or address fields
     * - organization contact details
     */
    public function show(Request $request, string $join_code): JsonResponse
    {
        $code = strtoupper($join_code);

        $workshop = Workshop::where('join_code', $code)
            ->where('status', 'published')
            ->with('defaultLocation')
            ->first();

        if (! $workshop) {
            return response()->json([
                'join_code' => [
                    'code' => $code,
                    'is_valid' => false,
                ],
                'error' => 'This join code is not valid or the workshop is no longer active.',
            ]);
        }

        $user = Auth::guard('sanctum')->user();
        $isAuthenticated = $user !== null;

        $isAlreadyRegistered = $isAuthenticated && Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->exists();

        $location = $workshop->defaultLocation;

        return response()->json([
            'join_code' => [
                'code' => $code,
                'is_valid' => true,
            ],
            'workshop' => [
                'id' => $workshop->id,
                'title' => $workshop->title,
                'workshop_type' => $workshop->workshop_type,
                'start_date' => $workshop->start_date?->toDateString(),
                'end_date' => $workshop->end_date?->toDateString(),
                'timezone' => $workshop->timezone,
                'public_summary' => $workshop->public_summary ?? null,
                'description' => $workshop->description,
                'social_share_image_url' => $workshop->header_image_url,
                'default_location' => $location ? [
                    'city' => $location->city,
                    'state_or_region' => $location->state_or_region,
                ] : null,
            ],
            'user_state' => [
                'is_authenticated' => $isAuthenticated,
                'is_already_registered' => $isAlreadyRegistered,
            ],
        ]);
    }
}
