<?php

namespace App\Domain\Sessions\Services;

use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Models\Session;

class EnforceSessionCapacityService
{
    /**
     * Check if a session has capacity available, using SELECT ... FOR UPDATE
     * to prevent race conditions on simultaneous selection.
     *
     * Must be called inside a database transaction.
     *
     * @throws SessionCapacityExceededException
     */
    public function enforceWithLock(Session $session): void
    {
        // Re-fetch the session row with a SELECT ... FOR UPDATE lock so that
        // concurrent transactions block here until we commit, preventing
        // simultaneous over-selection. The capacity and count must both be
        // read from within this lock — never from the pre-transaction model state.
        $locked = Session::lockForUpdate()->findOrFail($session->id);

        // Null capacity means unlimited — skip enforcement.
        if ($locked->capacity === null) {
            return;
        }

        // Count confirmed selections using the locked model's relationship
        // so the read is coherent with the locked row.
        $confirmedCount = $locked->selections()
            ->where('selection_status', 'selected')
            ->count();

        if ($confirmedCount >= $locked->capacity) {
            throw new SessionCapacityExceededException(
                "Session '{$locked->title}' is at full capacity ({$locked->capacity})."
            );
        }
    }
}
