<?php

namespace App\Domain\Sessions\Actions;

use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Domain\Sessions\Exceptions\SessionConflictException;
use App\Domain\Sessions\Services\DetectSelectionConflictService;
use App\Domain\Sessions\Services\EnforceSessionCapacityService;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use Illuminate\Support\Facades\DB;

class SelectSessionAction
{
    public function __construct(
        private readonly EnforceSessionCapacityService $capacityService,
        private readonly DetectSelectionConflictService $conflictService,
    ) {}

    /**
     * @throws SessionCapacityExceededException
     * @throws SessionConflictException
     * @throws \InvalidArgumentException
     */
    public function execute(Registration $registration, Session $session): SessionSelection
    {
        if (! $registration->isActive()) {
            throw new \InvalidArgumentException('Only active registrations can select sessions.');
        }

        if (! $session->is_published) {
            throw new \InvalidArgumentException('Session is not published and cannot be selected.');
        }

        return DB::transaction(function () use ($registration, $session) {
            // Check for time conflicts with other selected sessions.
            $this->conflictService->checkForConflict($registration, $session);

            // Check capacity with database-level locking.
            $this->capacityService->enforceWithLock($session);

            // Create or restore selection (idempotent on already-selected).
            $existing = SessionSelection::where('registration_id', $registration->id)
                ->where('session_id', $session->id)
                ->first();

            if ($existing) {
                if ($existing->selection_status === 'selected') {
                    return $existing;
                }
                $existing->update(['selection_status' => 'selected']);
                return $existing->fresh();
            }

            return SessionSelection::create([
                'registration_id'  => $registration->id,
                'session_id'       => $session->id,
                'selection_status' => 'selected',
            ]);
        });
    }
}
