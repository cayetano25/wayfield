<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ParticipantDashboardController extends Controller
{
    /**
     * GET /api/v1/me/dashboard
     *
     * Returns the authenticated user's personal workshop participation view.
     * Open to any authenticated user — organizers, leaders, and participants alike.
     * Returns what the user personally holds as a participant.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $registrations = Registration::where('user_id', $user->id)
            ->where('registration_status', 'registered')
            ->whereHas('workshop', fn ($q) => $q->where('status', 'published'))
            ->with(['workshop', 'workshop.defaultLocation', 'workshop.logistics'])
            ->get();

        if ($registrations->isEmpty()) {
            return response()->json([
                'active_workshop' => null,
                'other_workshops' => [],
            ]);
        }

        $today = now()->toDateString();

        // Sort: in-progress (0), upcoming (1), completed (2).
        // Within tier: upcoming = earliest first, completed = most recent first.
        $sorted = $registrations->sort(function (Registration $a, Registration $b) use ($today) {
            $aStart = $a->workshop->start_date?->toDateString() ?? $today;
            $aEnd = $a->workshop->end_date?->toDateString() ?? $today;
            $bStart = $b->workshop->start_date?->toDateString() ?? $today;
            $bEnd = $b->workshop->end_date?->toDateString() ?? $today;

            $aTier = $this->workshopTier($aStart, $aEnd, $today);
            $bTier = $this->workshopTier($bStart, $bEnd, $today);

            if ($aTier !== $bTier) {
                return $aTier <=> $bTier;
            }

            return match ($aTier) {
                1 => $aStart <=> $bStart, // upcoming: earliest first
                2 => $bEnd <=> $aEnd,     // completed: most recent first
                default => 0,
            };
        })->values();

        $activeReg = $sorted->first();
        $otherRegs = $sorted->slice(1)->values();

        return response()->json([
            'active_workshop' => $this->buildActiveWorkshop($user->id, $activeReg),
            'other_workshops' => $otherRegs->map(fn ($reg) => $this->buildOtherWorkshop($user->id, $reg))->values(),
        ]);
    }

    private function workshopTier(string $start, string $end, string $today): int
    {
        if ($start <= $today && $end >= $today) {
            return 0; // in-progress
        }

        return $start > $today ? 1 : 2; // upcoming : completed
    }

    private function buildActiveWorkshop(int $userId, Registration $reg): array
    {
        $workshop = $reg->workshop;
        $location = $workshop->defaultLocation;
        $logistics = $workshop->logistics;

        $sessionIds = SessionSelection::where('registration_id', $reg->id)
            ->where('selection_status', 'selected')
            ->pluck('session_id');

        $sessions = Session::whereIn('id', $sessionIds)
            ->with('location')
            ->orderBy('start_at')
            ->get();

        $attendanceMap = AttendanceRecord::where('user_id', $userId)
            ->whereIn('session_id', $sessionIds)
            ->get()
            ->keyBy('session_id');

        $now = Carbon::now();

        $nextSession = $sessions->first(function (Session $s) use ($attendanceMap, $now) {
            if ($s->start_at->lte($now)) {
                return false;
            }
            $record = $attendanceMap->get($s->id);

            return ($record?->status ?? 'not_checked_in') !== 'checked_in';
        });

        return [
            'workshop_id' => $workshop->id,
            'title' => $workshop->title,
            'description' => $workshop->description,
            'start_date' => $workshop->start_date?->toDateString(),
            'end_date' => $workshop->end_date?->toDateString(),
            'timezone' => $workshop->timezone,
            'location' => [
                'city' => $location?->city,
                'state_or_region' => $location?->state_or_region,
                'country' => $location?->country,
                'formatted' => $this->formatLocation($location),
            ],
            'registration_status' => $reg->registration_status,
            'next_session' => $nextSession ? $this->buildNextSession($nextSession, $attendanceMap) : null,
            'sessions' => $sessions->map(fn ($s) => $this->buildSessionItem($s, $attendanceMap))->values(),
            'logistics' => $logistics ? [
                'hotel_name' => $logistics->hotel_name,
                'hotel_address' => $logistics->hotel_address,
                'hotel_phone' => $logistics->hotel_phone,
                'meetup_instructions' => $logistics->meetup_instructions,
                'parking_details' => $logistics->parking_details,
            ] : null,
        ];
    }

    private function buildNextSession(Session $session, Collection $attendanceMap): array
    {
        $now = Carbon::now();

        return [
            'session_id' => $session->id,
            'title' => $session->title,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location_display' => $this->simpleLocationDisplay($session),
            'check_in_open' => $now->gte($session->start_at) && $now->lte($session->end_at),
        ];
    }

    private function buildSessionItem(Session $session, Collection $attendanceMap): array
    {
        $record = $attendanceMap->get($session->id);

        return [
            'session_id' => $session->id,
            'title' => $session->title,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location_display' => $this->simpleLocationDisplay($session),
            'attendance_status' => $record?->status ?? 'not_checked_in',
        ];
    }

    private function buildOtherWorkshop(int $userId, Registration $reg): array
    {
        $workshop = $reg->workshop;
        $today = now()->toDateString();
        $start = $workshop->start_date?->toDateString() ?? $today;
        $end = $workshop->end_date?->toDateString() ?? $today;

        $status = match ($this->workshopTier($start, $end, $today)) {
            0 => 'in_progress',
            1 => 'upcoming',
            default => 'completed',
        };

        $sessionCount = SessionSelection::where('registration_id', $reg->id)
            ->where('selection_status', 'selected')
            ->count();

        return [
            'workshop_id' => $workshop->id,
            'title' => $workshop->title,
            'start_date' => $start,
            'end_date' => $end,
            'status' => $status,
            'session_count' => $sessionCount,
        ];
    }

    /**
     * Returns a short human-readable location string for a session, or null.
     * Does not expose meeting URLs or private location details.
     */
    private function simpleLocationDisplay(Session $session): ?string
    {
        if ($session->location_type === Session::LOCATION_TYPE_HOTEL) {
            return 'Workshop Hotel';
        }

        if ($session->location) {
            return collect([$session->location->city, $session->location->state_or_region])
                ->filter()
                ->implode(', ') ?: null;
        }

        return null;
    }

    private function formatLocation(?object $location): ?string
    {
        if (! $location) {
            return null;
        }

        return collect([$location->city, $location->state_or_region, $location->country])
            ->filter()
            ->implode(', ') ?: null;
    }
}
