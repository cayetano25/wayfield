<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\Order;
use App\Http\Controllers\Controller;
use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\Workshop;
use App\Services\Sessions\SessionLocationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ParticipantDashboardController extends Controller
{
    public function __construct(
        private readonly SessionLocationService $locationService,
    ) {}

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
            ->with(['workshop', 'workshop.defaultLocation', 'workshop.logistics', 'workshop.logistics.hotelAddress'])
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

        if ($workshop->workshop_type === 'event_based') {
            $sessions = Session::where('workshop_id', $workshop->id)
                ->where('is_published', true)
                ->with(['location', 'location.address', 'leaders'])
                ->orderBy('start_at')
                ->get();
            $sessionIds = $sessions->pluck('id');
        } else {
            $sessionIds = SessionSelection::where('registration_id', $reg->id)
                ->where('selection_status', 'selected')
                ->pluck('session_id');

            $sessions = Session::whereIn('id', $sessionIds)
                ->with(['location', 'location.address', 'leaders'])
                ->orderBy('start_at')
                ->get();
        }

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

        // Count all published sessions available for selection (session_based workshops).
        $totalSelectable = $workshop->workshop_type === 'session_based'
            ? Session::where('workshop_id', $workshop->id)->where('is_published', true)->count()
            : 0;

        $totalSelected = $sessionIds->count();

        // Pre-bind the workshop relation on each session so resolveForDisplay()
        // can access workshop.logistics without extra queries.
        $sessions->each(fn ($s) => $s->setRelation('workshop', $workshop));

        $sessionItems = $sessions->map(fn ($s) => $this->buildSessionItem($s, $attendanceMap, $nextSession?->id, $workshop))->values();

        return [
            'workshop_id' => $workshop->id,
            'title' => $workshop->title,
            'description' => $workshop->description,
            'header_image_url' => $workshop->header_image_url,
            'workshop_type' => $workshop->workshop_type,
            'public_slug' => $workshop->public_slug,
            'public_page_enabled' => (bool) $workshop->public_page_enabled,
            'total_selectable' => $totalSelectable,
            'total_selected' => $totalSelected,
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
            'default_location_id' => $workshop->default_location_id,
            'next_session' => $nextSession ? $this->buildNextSession($nextSession) : null,
            'sessions' => $sessionItems,
            'logistics' => $logistics ? [
                'hotel_name' => $logistics->hotel_name,
                'hotel_address_display' => $logistics->hotel_address ?? $logistics->hotelAddress?->formatted_address,
                'hotel_phone' => $logistics->hotel_phone,
                'hotel_notes' => $logistics->hotel_notes,
                'parking_details' => $logistics->parking_details,
                'meeting_room_details' => $logistics->meeting_room_details,
                'meetup_instructions' => $logistics->meetup_instructions,
                'location_name' => $location?->name,
                'venue_address_display' => $location ? $this->formatVenueAddress($location) : null,
                'location_lat' => $location?->latitude ? (float) $location->latitude : null,
                'location_lng' => $location?->longitude ? (float) $location->longitude : null,
                'workshop_image_url' => $workshop->header_image_url,
            ] : null,
        ];
    }

    private function buildNextSession(Session $session): array
    {
        $now = Carbon::now();

        return [
            'id' => $session->id,
            'title' => $session->title,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location_display' => $this->simpleLocationDisplay($session),
            'check_in_open' => $now->gte($session->start_at) && $now->lte($session->end_at),
            'delivery_type' => $session->delivery_type,
        ];
    }

    private function buildSessionItem(Session $session, Collection $attendanceMap, ?int $nextSessionId, Workshop $workshop): array
    {
        $record = $attendanceMap->get($session->id);

        // Use SessionLocationService for canonical Phase-16-aware location resolution.
        // The workshop relation was pre-bound on each session before this loop so that
        // hotel-type sessions can access workshop.logistics without extra queries.
        $resolvedLocation = $this->locationService->resolveForDisplay($session);

        return [
            'id' => $session->id,
            'title' => $session->title,
            'description' => $session->description,
            'start_at' => $session->start_at->toIso8601String(),
            'end_at' => $session->end_at->toIso8601String(),
            'location_display' => $this->simpleLocationDisplay($session),
            'location' => $resolvedLocation['type'] !== null ? $resolvedLocation : null,
            'leaders' => $session->leaders->map(fn ($leader) => [
                'id' => $leader->id,
                'first_name' => $leader->first_name,
                'last_name' => $leader->last_name,
                'city' => $leader->city,
                'state_or_region' => $leader->state_or_region,
                'bio' => $leader->bio,
                'profile_image_url' => $leader->profile_image_url,
            ])->values()->all(),
            'attendance_status' => $record?->status ?? 'not_checked_in',
            'is_next' => $session->id === $nextSessionId,
            'delivery_type' => $session->delivery_type,
        ];
    }

    private function buildOtherWorkshop(int $userId, Registration $reg): array
    {
        $workshop = $reg->workshop;
        $today = now()->toDateString();
        $start = $workshop->start_date?->toDateString() ?? $today;
        $end = $workshop->end_date?->toDateString() ?? $today;

        $tier = $this->workshopTier($start, $end, $today);
        $status = match ($tier) {
            0 => 'in_progress',
            1 => 'upcoming',
            default => 'completed',
        };

        $selectedSessionIds = SessionSelection::where('registration_id', $reg->id)
            ->where('selection_status', 'selected')
            ->pluck('session_id');

        $checkedInCount = $selectedSessionIds->isNotEmpty()
            ? AttendanceRecord::where('user_id', $userId)
                ->whereIn('session_id', $selectedSessionIds)
                ->where('status', 'checked_in')
                ->count()
            : 0;

        // Fetch the most recent non-cancelled order for this user+workshop for payment status.
        $order = Order::query()
            ->where('user_id', $userId)
            ->where('organization_id', $workshop->organization_id)
            ->whereHas('items', fn ($q) => $q->where('item_type', 'workshop_registration')->where('workshop_id', $workshop->id))
            ->whereNotIn('status', ['cancelled', 'fully_refunded'])
            ->latest()
            ->first();

        return [
            'workshop_id' => $workshop->id,
            'title' => $workshop->title,
            'workshop_type' => $workshop->workshop_type,
            'public_slug' => $workshop->public_slug,
            'public_page_enabled' => (bool) $workshop->public_page_enabled,
            'start_date' => $start,
            'end_date' => $end,
            'status' => $status,
            'sessions_count' => $selectedSessionIds->count(),
            'checked_in_count' => $checkedInCount,
            'total_sessions' => $selectedSessionIds->count(),
            'payment_status' => $order ? $order->getPaymentStatusLabel() : null,
            'balance_due_date' => $order?->balance_due_date?->toDateString(),
            'order_number' => $order?->order_number,
        ];
    }

    private function simpleLocationDisplay(Session $session): ?string
    {
        if ($session->location_type === Session::LOCATION_TYPE_HOTEL) {
            // Use the hotel name from logistics if available; workshop relation is pre-bound.
            return $session->workshop?->logistics?->hotel_name ?? 'Workshop Hotel';
        }

        if ($session->location) {
            // For address/coordinate sessions, show locality from the canonical address
            // or fall back to the flat city field (legacy locations).
            $loc = $session->location;
            if ($loc->address) {
                return $loc->address->locality
                    ? collect([$loc->address->locality, $loc->address->administrative_area])
                        ->filter()
                        ->implode(', ')
                    : null;
            }

            return collect([$loc->city, $loc->state_or_region])
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

    private function formatVenueAddress(?object $location): ?string
    {
        if (! $location) {
            return null;
        }

        $parts = array_filter([
            $location->address_line_1,
            $location->address_line_2,
            trim(implode(', ', array_filter([$location->city, $location->state_or_region]))),
            $location->postal_code,
            $location->country,
        ]);

        return implode(', ', $parts) ?: null;
    }
}
