<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Sessions\Actions\DeselectSessionAction;
use App\Domain\Sessions\Actions\SelectSessionAction;
use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Domain\Sessions\Exceptions\SessionConflictException;
use App\Domain\Sessions\Exceptions\SessionSelectionException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SelectSessionRequest;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\Workshop;
use App\Services\Sessions\SessionLocationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

class SessionSelectionController extends Controller
{
    public function __construct(
        private readonly SessionLocationService $locationService,
    ) {}

    /**
     * GET /api/v1/workshops/{workshop}/selection-options
     *
     * Returns all published sessions grouped by day with per-session state
     * (available / selected / conflicted / full) computed server-side for
     * this participant. No N+1 queries.
     */
    public function options(Workshop $workshop): JsonResponse
    {
        $user = request()->user();

        $registration = $this->findRegistration($workshop, $user->id);
        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        // Eager-load workshop logistics once for hotel-type location lookups.
        $workshop->loadMissing('logistics');

        // Single query: sessions visible to participants (published + visible + self_select)
        // with leaders + enrolled count. Uses scopeVisibleToParticipants() which enforces
        // publication_status, participant_visibility, and enrollment_mode atomically.
        $sessions = Session::where('workshop_id', $workshop->id)
            ->visibleToParticipants()
            ->with(['location', 'location.address', 'leaders'])
            ->withCount(['selections as enrolled_count' => fn ($q) => $q->where('selection_status', 'selected')])
            ->orderBy('start_at')
            ->get();

        // Share the already-loaded workshop object (avoids N+1 for hotel lookups).
        $sessions->each(fn ($s) => $s->setRelation('workshop', $workshop));

        // IDs this user has currently selected.
        $selectedIds = SessionSelection::where('registration_id', $registration->id)
            ->where('selection_status', 'selected')
            ->pluck('session_id')
            ->toArray();

        // Subset of sessions this user has selected — used for overlap checks.
        $selectedSessions = $sessions->filter(fn ($s) => in_array($s->id, $selectedIds));

        $tz = $workshop->timezone ?: 'UTC';

        // Annotate each session with state + conflict_with before grouping.
        $annotated = $sessions->map(function (Session $session) use ($selectedIds, $selectedSessions, $tz) {
            $enrolledCount = (int) $session->enrolled_count;
            $state = $this->computeState($session, $selectedIds, $selectedSessions, $enrolledCount);

            $conflictWith = null;
            if ($state === 'conflicted') {
                $conflicting = $this->findConflict($session, $selectedSessions);
                if ($conflicting) {
                    $conflictWith = [
                        'session_id' => $conflicting->id,
                        'title' => $conflicting->title,
                    ];
                }
            }

            $carbonStart = Carbon::parse($session->start_at)->timezone($tz);
            $carbonEnd = Carbon::parse($session->end_at)->timezone($tz);

            return [
                'date_key' => $carbonStart->format('Y-m-d'),
                'slot_key' => $carbonStart->format('H:i'),
                'session_id' => $session->id,
                'title' => $session->title,
                'description' => $session->description,
                'start_at' => $session->start_at->toIso8601String(),
                'end_at' => $session->end_at->toIso8601String(),
                'start_display' => $carbonStart->format('g:i A'),
                'end_display' => $carbonEnd->format('g:i A'),
                'duration_minutes' => (int) $session->start_at->diffInMinutes($session->end_at),
                'delivery_type' => $session->delivery_type,
                'location_display' => $this->buildLocationDisplay($session),
                'leaders' => $session->leaders->map(fn ($l) => [
                    'first_name' => $l->first_name,
                    'last_name' => $l->last_name,
                    'profile_image_url' => $l->profile_image_url,
                ])->values(),
                'capacity' => $session->capacity,
                'enrolled_count' => $enrolledCount,
                'spots_remaining' => $session->capacity !== null
                    ? max(0, $session->capacity - $enrolledCount)
                    : null,
                'state' => $state,
                'conflict_with' => $conflictWith,
            ];
        });

        // Group sessions by day → then by time slot.
        $days = $annotated
            ->groupBy('date_key')
            ->map(function (Collection $daySessions, string $date) use ($tz) {
                // Derive day labels from the first session's start time.
                $carbon = Carbon::parse($daySessions->first()['start_at'])->timezone($tz);

                $timeSlots = $daySessions
                    ->groupBy('slot_key')
                    ->map(function (Collection $slotSessions) {
                        $first = $slotSessions->first();

                        return [
                            'slot_time' => $first['start_display'],
                            'is_parallel' => $slotSessions->count() > 1,
                            'sessions' => $slotSessions
                                ->map(fn ($s) => array_diff_key($s, ['date_key' => 0, 'slot_key' => 0]))
                                ->values(),
                        ];
                    })
                    ->values();

                return [
                    'date' => $date,
                    'day_label' => $carbon->format('l'),
                    'day_short' => strtoupper(substr($carbon->format('D'), 0, 3)),
                    'date_formatted' => $carbon->format('F j'),
                    'time_slots' => $timeSlots,
                ];
            })
            ->values();

        return response()->json([
            'workshop' => [
                'id' => $workshop->id,
                'title' => $workshop->title,
                'start_date' => $workshop->start_date?->format('Y-m-d'),
                'end_date' => $workshop->end_date?->format('Y-m-d'),
                'timezone' => $workshop->timezone,
                'workshop_type' => $workshop->workshop_type,
            ],
            'selection_summary' => [
                'total_selectable' => $sessions->count(),
                'total_selected' => count($selectedIds),
                'has_conflicts' => $annotated->contains('state', 'conflicted'),
            ],
            'selected_session_ids' => array_values($selectedIds),
            'days' => $days,
        ]);
    }

    /**
     * POST /api/v1/workshops/{workshop}/selections
     *
     * Selects a session for the authenticated participant. Idempotent on
     * already-selected (returns 200). Enforces workshop type, conflict
     * detection, and capacity with SELECT…FOR UPDATE inside a transaction.
     */
    public function store(
        SelectSessionRequest $request,
        Workshop $workshop,
        SelectSessionAction $action,
    ): JsonResponse {
        $user = request()->user();

        $registration = $this->findRegistration($workshop, $user->id);
        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        if (! $workshop->isSessionBased()) {
            return response()->json([
                'error' => 'event_based_workshop',
                'message' => 'Session selection is not available for event-based workshops.',
            ], 422);
        }

        $session = Session::find($request->validated('session_id'));

        if (! $session || $session->workshop_id !== $workshop->id) {
            return response()->json(['message' => 'Session not found in this workshop.'], 404);
        }

        $tz = $workshop->timezone ?: 'UTC';

        // Idempotent: already selected → 200, no re-processing.
        $alreadySelected = SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->exists();

        if ($alreadySelected) {
            return response()->json(
                $this->buildStoreSuccess($registration, $session, $tz, 'Session already in your schedule.'),
                200
            );
        }

        try {
            $action->execute($registration, $session);
        } catch (SessionSelectionException $e) {
            // New gate errors: not published, not visible, not self-selectable, window closed.
            return response()->json([
                'error' => $e->getErrorCode(),
                'message' => $e->getMessage(),
            ], 422);
        } catch (SessionConflictException $e) {
            $conflictWith = null;
            if ($e->getConflictingSessionId()) {
                $conflictWith = [
                    'session_id' => $e->getConflictingSessionId(),
                    'title' => $e->getConflictingSessionTitle(),
                    'start_display' => $e->getConflictingSessionStartAt()
                        ? Carbon::parse($e->getConflictingSessionStartAt())->timezone($tz)->format('g:i A')
                        : null,
                    'end_display' => $e->getConflictingSessionEndAt()
                        ? Carbon::parse($e->getConflictingSessionEndAt())->timezone($tz)->format('g:i A')
                        : null,
                ];
            }

            return response()->json([
                'error' => 'time_conflict',
                'message' => "This session overlaps with one you've already selected.",
                'conflict_with' => $conflictWith,
            ], 422);
        } catch (SessionCapacityExceededException) {
            return response()->json([
                'error' => 'session_full',
                'message' => 'This session is now full.',
                'session_title' => $session->title,
            ], 422);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(
            $this->buildStoreSuccess($registration, $session, $tz, 'Session added to your schedule.'),
            201
        );
    }

    /**
     * DELETE /api/v1/workshops/{workshop}/selections/{session}
     *
     * Deselects a session by setting selection_status = 'canceled'.
     * Returns 404 if no active selection exists.
     * Returns 422 if the participant has already checked in.
     */
    public function destroy(
        Workshop $workshop,
        Session $session,
        DeselectSessionAction $action,
    ): JsonResponse {
        $user = request()->user();

        $registration = $this->findRegistration($workshop, $user->id);
        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        $selectionExists = SessionSelection::where('registration_id', $registration->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->exists();

        if (! $selectionExists) {
            return response()->json(['message' => 'No active selection found for this session.'], 404);
        }

        // CannotDeselectCheckedInSessionException has a render() method that
        // returns 422 automatically; re-throwing lets Laravel handle it.
        $action->execute($registration, $session);

        $totalSelected = SessionSelection::where('registration_id', $registration->id)
            ->where('selection_status', 'selected')
            ->count();

        return response()->json([
            'message' => 'Session removed from your schedule.',
            'updated_summary' => [
                'total_selected' => $totalSelected,
            ],
        ]);
    }

    /**
     * GET /api/v1/workshops/{workshop}/my-selections
     *
     * Returns only the current user's selected sessions, ordered by start_at.
     * Lightweight schedule sidebar endpoint — does not re-fetch all options.
     */
    public function mySelections(Workshop $workshop): JsonResponse
    {
        $user = request()->user();

        $registration = $this->findRegistration($workshop, $user->id);
        if (! $registration) {
            return response()->json(['message' => 'You are not registered for this workshop.'], 403);
        }

        $workshop->loadMissing('logistics');
        $tz = $workshop->timezone ?: 'UTC';

        $selectedIds = SessionSelection::where('registration_id', $registration->id)
            ->where('selection_status', 'selected')
            ->pluck('session_id');

        $sessions = Session::whereIn('id', $selectedIds)
            ->with(['location', 'leaders'])
            ->orderBy('start_at')
            ->get();

        $sessions->each(fn ($s) => $s->setRelation('workshop', $workshop));

        $selected = $sessions->map(function (Session $session) use ($tz) {
            $carbonStart = Carbon::parse($session->start_at)->timezone($tz);

            return [
                'session_id' => $session->id,
                'title' => $session->title,
                'start_at' => $session->start_at->toIso8601String(),
                'end_at' => $session->end_at->toIso8601String(),
                'start_display' => $carbonStart->format('g:i A'),
                'end_display' => Carbon::parse($session->end_at)->timezone($tz)->format('g:i A'),
                'day_label' => $carbonStart->format('l'),
                'day_short' => strtoupper(substr($carbonStart->format('D'), 0, 3)),
                'location_display' => $this->buildLocationDisplay($session),
                'leaders' => $session->leaders->map(fn ($l) => [
                    'first_name' => $l->first_name,
                    'last_name' => $l->last_name,
                    'profile_image_url' => $l->profile_image_url,
                ])->values(),
            ];
        })->values();

        return response()->json([
            'selected_sessions' => $selected,
            'total_selected' => $selected->count(),
        ]);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function findRegistration(Workshop $workshop, int $userId): ?Registration
    {
        return Registration::where('workshop_id', $workshop->id)
            ->where('user_id', $userId)
            ->where('registration_status', 'registered')
            ->first();
    }

    /**
     * Compute the four-state value for a session for this participant.
     *
     * Priority order:
     *   1. selected  — user has an active selection
     *   2. full      — at capacity (null capacity = unlimited, never full)
     *   3. conflicted — overlaps a selected session's time range
     *   4. available — everything else
     */
    private function computeState(
        Session $session,
        array $selectedIds,
        Collection $selectedSessions,
        int $enrolledCount,
    ): string {
        if (in_array($session->id, $selectedIds)) {
            return 'selected';
        }

        if ($session->capacity !== null && $enrolledCount >= $session->capacity) {
            return 'full';
        }

        if ($this->findConflict($session, $selectedSessions) !== null) {
            return 'conflicted';
        }

        return 'available';
    }

    /**
     * Returns the first selected session that overlaps $session, or null.
     * Overlap: A.start < B.end AND A.end > B.start (half-open interval).
     */
    private function findConflict(Session $session, Collection $selectedSessions): ?Session
    {
        foreach ($selectedSessions as $selected) {
            if ($selected->id !== $session->id
                && $session->start_at->lt($selected->end_at)
                && $session->end_at->gt($selected->start_at)
            ) {
                return $selected;
            }
        }

        return null;
    }

    /**
     * Build a simple human-readable location label for participant-facing surfaces.
     *
     * hotel      → hotel name from workshop logistics
     * address /
     * coordinates → location name, or fall back to location_notes
     */
    private function buildLocationDisplay(Session $session): ?string
    {
        if ($session->location_type === Session::LOCATION_TYPE_HOTEL) {
            return $session->workshop->logistics?->hotel_name ?? 'Workshop Hotel';
        }

        return $session->location?->name ?? $session->location_notes;
    }

    /**
     * Build the shared success payload for store() — used for both 200 and 201.
     */
    private function buildStoreSuccess(
        Registration $registration,
        Session $session,
        string $tz,
        string $message,
    ): array {
        $totalSelected = SessionSelection::where('registration_id', $registration->id)
            ->where('selection_status', 'selected')
            ->count();

        return [
            'message' => $message,
            'selection' => [
                'session_id' => $session->id,
                'title' => $session->title,
                'start_display' => Carbon::parse($session->start_at)->timezone($tz)->format('g:i A'),
                'end_display' => Carbon::parse($session->end_at)->timezone($tz)->format('g:i A'),
            ],
            'updated_summary' => [
                'total_selected' => $totalSelected,
            ],
        ];
    }
}
