<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ParticipantSessionResource;
use App\Models\Registration;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class MyScheduleController extends Controller
{
    /**
     * GET /api/v1/workshops/{workshop}/my-schedule
     * Return the participant's personal schedule for a workshop.
     *
     * Session-based: returns explicitly selected sessions.
     * Event-based: returns all published sessions (schedule is informational).
     */
    public function show(Workshop $workshop): JsonResponse
    {
        $user = Auth::user();

        $registration = Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        if ($workshop->isSessionBased()) {
            $selectedSessionIds = $registration->selections()
                ->where('selection_status', 'selected')
                ->pluck('session_id');

            $sessions = Session::whereIn('id', $selectedSessionIds)
                ->with(['track', 'location'])
                ->orderBy('start_at')
                ->get();
        } else {
            // Event-based: full published schedule is the participant's schedule.
            $sessions = Session::where('workshop_id', $workshop->id)
                ->where('is_published', true)
                ->with(['track', 'location'])
                ->orderBy('start_at')
                ->get();
        }

        return response()->json(ParticipantSessionResource::collection($sessions));
    }
}
