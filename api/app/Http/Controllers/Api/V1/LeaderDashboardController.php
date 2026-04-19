<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Notifications\Services\EnforceLeaderMessagingRulesService;
use App\Http\Controllers\Controller;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Session;
use App\Models\SessionLeader;
use Carbon\Carbon;
use DateTimeZone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class LeaderDashboardController extends Controller
{
    public function __construct(
        private readonly EnforceLeaderMessagingRulesService $messagingService,
    ) {}

    /**
     * GET /api/v1/leader/dashboard
     *
     * Returns the leader's personal dashboard: pending invitations, today's sessions,
     * sessions this week, and upcoming sessions for the next 60 days.
     *
     * Authorization: user must have a linked leaders record (leaders.user_id = user.id).
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $leader = Leader::where('user_id', $user->id)->first();

        if (! $leader) {
            return response()->json(['error' => 'no_leader_record'], 403);
        }

        // Fetch all relevant sessions in one query covering today + next 60 days,
        // with a 26-hour buffer on either side to accommodate any workshop timezone.
        $allSessions = $this->fetchRelevantSessions($leader);

        [$todaySessions, $weekSessions, $upcomingSessions] = $this->categoriseSessions($allSessions);

        return response()->json([
            'pending_invitations' => $this->buildPendingInvitations($leader),
            'today' => [
                'date' => strtoupper(Carbon::now()->format('M d, Y')),
                'sessions' => $todaySessions->map(fn ($s) => $this->buildTodaySession($s))->values(),
            ],
            'this_week' => $weekSessions->map(fn ($s) => $this->buildWeekSession($s))->values(),
            'upcoming' => $upcomingSessions->take(10)->map(fn ($s) => $this->buildUpcomingSession($s))->values(),
        ]);
    }

    // ─── Data fetching ────────────────────────────────────────────────────────

    private function fetchRelevantSessions(Leader $leader): Collection
    {
        $sessionIds = SessionLeader::where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->pluck('session_id');

        return Session::whereIn('id', $sessionIds)
            ->where('start_at', '>=', now()->subDay())
            ->where('start_at', '<=', now()->addDays(61))
            ->with(['workshop', 'workshop.defaultLocation', 'location', 'selections', 'attendanceRecords'])
            ->orderBy('start_at')
            ->get();
    }

    /**
     * Splits sessions into today / this-week / upcoming buckets using the parent
     * workshop's timezone so the day boundary is correct in every locale.
     *
     * @return array{0: Collection, 1: Collection, 2: Collection}
     */
    private function categoriseSessions(Collection $sessions): array
    {
        $today = collect();
        $week = collect();
        $upcoming = collect();

        foreach ($sessions as $session) {
            $tz = new DateTimeZone($session->workshop->timezone ?? 'UTC');
            $sessionDate = Carbon::parse($session->start_at)->setTimezone($tz)->toDateString();
            $todayDate = Carbon::now($tz)->toDateString();
            $weekEnd = Carbon::now($tz)->addDays(7)->toDateString();

            if ($sessionDate === $todayDate) {
                $today->push($session);
            } elseif ($sessionDate > $todayDate && $sessionDate <= $weekEnd) {
                $week->push($session);
            } elseif ($sessionDate > $weekEnd) {
                $upcoming->push($session);
            }
        }

        return [$today, $week, $upcoming];
    }

    // ─── Response builders ────────────────────────────────────────────────────

    private function buildPendingInvitations(Leader $leader): array
    {
        $invitations = LeaderInvitation::where('leader_id', $leader->id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->with(['organization', 'workshop'])
            ->get();

        return $invitations->map(function (LeaderInvitation $inv) {
            $workshop = $inv->workshop;

            if ($workshop) {
                $dates = $workshop->start_date->format('F j')
                    .'–'
                    .$workshop->end_date->format('j, Y');
            } else {
                $dates = null;
            }

            return [
                'invitation_id' => $inv->id,
                'organization_name' => $inv->organization->name,
                'workshop_title' => $workshop?->title ?? 'General Invitation',
                'workshop_dates' => $dates,
                'expires_at' => $inv->expires_at->toIso8601String(),
                'accept_url' => url("/api/v1/leader-invitations/{$inv->id}/(token)/accept"),
                'decline_url' => url("/api/v1/leader-invitations/{$inv->id}/(token)/decline"),
            ];
        })->values()->all();
    }

    private function buildTodaySession(Session $session): array
    {
        $now = Carbon::now();
        $isLive = $now->gte($session->start_at) && $now->lte($session->end_at);
        $window = $this->messagingService->getWindow($session);

        $tz = new DateTimeZone($session->workshop->timezone ?? 'UTC');
        $windowNow = Carbon::now($tz);
        $isWindowOpen = $windowNow->gte($window['start']) && $windowNow->lte($window['end']);

        $enrolledCount = $session->selections->where('selection_status', 'selected')->count();
        $checkedInCount = $session->attendanceRecords->where('status', 'checked_in')->count();

        [$location, $workshopDefaultLocationId] = $this->buildLocationPayload($session);

        return [
            'session_id' => $session->id,
            'workshop_title' => $session->workshop->title,
            'workshop_timezone' => $session->workshop->timezone,
            'session_title' => $session->title,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location' => $location,
            'location_display' => $this->simpleLocationDisplay($session),
            'workshop_default_location_id' => $workshopDefaultLocationId,
            'enrolled_count' => $enrolledCount,
            'checked_in_count' => $checkedInCount,
            'is_live' => $isLive,
            'messaging_window' => [
                'is_open' => $isWindowOpen,
                'opens_at' => $window['start']->toIso8601String(),
                'closes_at' => $window['end']->toIso8601String(),
            ],
        ];
    }

    private function buildWeekSession(Session $session): array
    {
        $tz = new DateTimeZone($session->workshop->timezone ?? 'UTC');
        $sessionDate = Carbon::parse($session->start_at)->setTimezone($tz);
        $enrolledCount = $session->selections->where('selection_status', 'selected')->count();

        [$location, $workshopDefaultLocationId] = $this->buildLocationPayload($session);

        return [
            'session_id' => $session->id,
            'session_title' => $session->title,
            'workshop_title' => $session->workshop->title,
            'workshop_timezone' => $session->workshop->timezone,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location' => $location,
            'location_display' => $this->simpleLocationDisplay($session),
            'workshop_default_location_id' => $workshopDefaultLocationId,
            'enrolled_count' => $enrolledCount,
            'capacity' => $session->capacity,
            'day_label' => strtoupper($sessionDate->format('D j')),
        ];
    }

    private function buildUpcomingSession(Session $session): array
    {
        $enrolledCount = $session->selections->where('selection_status', 'selected')->count();

        [$location, $workshopDefaultLocationId] = $this->buildLocationPayload($session);

        return [
            'session_id' => $session->id,
            'session_title' => $session->title,
            'workshop_title' => $session->workshop->title,
            'workshop_timezone' => $session->workshop->timezone,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location' => $location,
            'location_display' => $this->simpleLocationDisplay($session),
            'workshop_default_location_id' => $workshopDefaultLocationId,
            'enrolled_count' => $enrolledCount,
            'capacity' => $session->capacity,
        ];
    }

    /**
     * Resolves the effective location for a session and returns it as a payload array
     * alongside the workshop's default_location_id (for "same as workshop venue" comparison).
     *
     * Hotel-type sessions resolve to the workshop's default location. Coordinate-only
     * locations are included even if no address text is present.
     *
     * @return array{0: array<string, mixed>|null, 1: int|null}
     */
    private function buildLocationPayload(Session $session): array
    {
        $workshopDefaultLocationId = $session->workshop->default_location_id;

        $loc = null;
        if ($session->location_type === Session::LOCATION_TYPE_HOTEL) {
            $loc = $session->workshop->defaultLocation ?? null;
        } elseif ($session->location_id && $session->location) {
            $loc = $session->location;
        }

        if (! $loc) {
            return [null, $workshopDefaultLocationId];
        }

        return [
            [
                'id' => $loc->id,
                'name' => $loc->name,
                'address_line_1' => $loc->address_line_1,
                'address_line_2' => $loc->address_line_2,
                'city' => $loc->city,
                'state_or_region' => $loc->state_or_region,
                'postal_code' => $loc->postal_code,
                'latitude' => $loc->latitude !== null ? (float) $loc->latitude : null,
                'longitude' => $loc->longitude !== null ? (float) $loc->longitude : null,
            ],
            $workshopDefaultLocationId,
        ];
    }

    private function simpleLocationDisplay(Session $session): ?string
    {
        if ($session->location_type === Session::LOCATION_TYPE_HOTEL) {
            return 'Workshop Hotel';
        }

        if ($session->location_id && $session->relationLoaded('location') && $session->location) {
            return collect([$session->location->city, $session->location->state_or_region])
                ->filter()
                ->implode(', ') ?: null;
        }

        return null;
    }
}
