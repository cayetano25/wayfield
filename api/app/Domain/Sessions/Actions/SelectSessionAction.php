<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Domain\Sessions\Exceptions\SessionConflictException;
use App\Domain\Sessions\Exceptions\SessionSelectionException;
use App\Domain\Sessions\Services\DetectSelectionConflictService;
use App\Domain\Sessions\Services\EnforceSessionCapacityService;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SelectSessionAction
{
    public function __construct(
        private readonly EnforceSessionCapacityService $capacityService,
        private readonly DetectSelectionConflictService $conflictService,
    ) {}

    /**
     * Attempt to self-select a session for a participant.
     *
     * Seven-condition gate (all must pass):
     *   1. registration_status = registered         → handled by caller; throw on failure
     *   2. publication_status = published
     *   3. participant_visibility = visible
     *   4. enrollment_mode = self_select
     *   5. no duplicate selected row
     *   6. capacity check with SELECT…FOR UPDATE
     *   7. no schedule conflict
     *   + selection_opens_at / selection_closes_at window (when set)
     *
     * On success the selection row is created with assignment_source = 'self_selected'.
     *
     * @throws SessionSelectionException
     * @throws SessionCapacityExceededException — re-mapped to SESSION_AT_CAPACITY in controller
     * @throws SessionConflictException         — re-mapped to SCHEDULE_CONFLICT in controller
     */
    public function execute(Registration $registration, Session $session): SessionSelection
    {
        if (! $registration->isActive()) {
            throw new \InvalidArgumentException('Only active registrations can select sessions.');
        }

        // ── Gate 2: publication_status ────────────────────────────────────────
        if ($session->publication_status !== 'published') {
            throw new SessionSelectionException(
                SessionSelectionException::SESSION_NOT_PUBLISHED,
                'This session is not published and cannot be selected.',
            );
        }

        // ── Gate 3: participant_visibility ────────────────────────────────────
        if ($session->participant_visibility !== 'visible') {
            throw new SessionSelectionException(
                SessionSelectionException::SESSION_NOT_VISIBLE_FOR_SELECTION,
                'This session is not available for selection.',
            );
        }

        // ── Gate 4: enrollment_mode ───────────────────────────────────────────
        if ($session->enrollment_mode !== 'self_select') {
            throw new SessionSelectionException(
                SessionSelectionException::SESSION_NOT_SELF_SELECTABLE,
                'This session requires organizer assignment and cannot be self-selected.',
            );
        }

        // ── Gate: selection window (when configured) ──────────────────────────
        if ($session->selection_opens_at || $session->selection_closes_at) {
            $now = Carbon::now();

            if ($session->selection_opens_at && $now->lt($session->selection_opens_at)) {
                throw new SessionSelectionException(
                    SessionSelectionException::SESSION_SELECTION_WINDOW_CLOSED,
                    'Session selection has not opened yet.',
                    [
                        'selection_opens_at' => $session->selection_opens_at->toIso8601String(),
                    ],
                );
            }

            if ($session->selection_closes_at && $now->gt($session->selection_closes_at)) {
                throw new SessionSelectionException(
                    SessionSelectionException::SESSION_SELECTION_WINDOW_CLOSED,
                    'Session selection has closed.',
                    [
                        'selection_closes_at' => $session->selection_closes_at->toIso8601String(),
                    ],
                );
            }
        }

        return DB::transaction(function () use ($registration, $session) {
            // ── Gate 5: duplicate check ───────────────────────────────────────
            $existing = SessionSelection::where('registration_id', $registration->id)
                ->where('session_id', $session->id)
                ->first();

            if ($existing && $existing->selection_status === 'selected') {
                return $existing;
            }

            // ── Gate 7: schedule conflict ─────────────────────────────────────
            $this->conflictService->checkForConflict($registration, $session);

            // ── Gate 6: capacity with SELECT…FOR UPDATE ───────────────────────
            $this->capacityService->enforceWithLock($session);

            // ── Create or restore ─────────────────────────────────────────────
            if ($existing) {
                $existing->update([
                    'selection_status' => 'selected',
                    'assignment_source' => 'self_selected',
                    'assigned_by_user_id' => null,
                    'assigned_at' => null,
                ]);

                return $existing->fresh();
            }

            return SessionSelection::create([
                'registration_id' => $registration->id,
                'session_id' => $session->id,
                'selection_status' => 'selected',
                'assignment_source' => 'self_selected',
                'assigned_by_user_id' => null,
                'assigned_at' => null,
            ]);
        });
    }
}
