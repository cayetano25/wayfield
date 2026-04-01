<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Attendance\Services\BuildSessionRosterService;
use App\Domain\Attendance\Services\BuildWorkshopAttendanceSummaryService;
use App\Http\Controllers\Controller;
use App\Http\Resources\AttendanceSummaryResource;
use App\Http\Resources\RosterParticipantResource;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RosterController extends Controller
{
    public function __construct(
        private readonly BuildSessionRosterService             $rosterService,
        private readonly BuildWorkshopAttendanceSummaryService $summaryService,
    ) {}

    /**
     * GET /api/v1/sessions/{session}/roster
     *
     * Returns the roster for a session.
     * Phone numbers are only included for authorized viewers.
     */
    public function sessionRoster(Request $request, Session $session): JsonResponse
    {
        $this->authorize('roster.view', $session);

        $session->loadMissing('workshop');

        // Determine if the requesting user is allowed to see phone numbers
        $canSeePhones = $request->user()->can('roster.view-phones', $session);

        $entries = $this->rosterService->build($session);

        $resources = $entries->map(function ($entry) use ($canSeePhones) {
            return (new RosterParticipantResource($entry))
                ->additional(['show_phone' => $canSeePhones]);
        });

        return response()->json(['data' => $resources->values()->all()]);
    }

    /**
     * GET /api/v1/workshops/{workshop}/attendance-summary
     *
     * Aggregate attendance summary across all sessions. Organizer-only.
     */
    public function workshopSummary(Request $request, Workshop $workshop): JsonResponse
    {
        $this->authorize('update', $workshop);

        $summary = $this->summaryService->build($workshop);

        return response()->json(new AttendanceSummaryResource($summary));
    }
}
