<?php

namespace App\Domain\Sessions\Services;

use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Domain\Webhooks\WebhookDispatcher;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Support\Facades\Log;

class EnforceSessionCapacityService
{
    public function __construct(private readonly WebhookDispatcher $webhookDispatcher) {}

    /**
     * Check if a session has capacity available, using SELECT ... FOR UPDATE
     * to prevent race conditions on simultaneous selection.
     *
     * Must be called inside a database transaction.
     *
     * When capacity is exactly reached (confirmedCount + 1 == capacity after
     * the new selection is committed), dispatches a 'session.capacity_reached'
     * webhook event. Webhook failure never propagates.
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

        // If this selection fills the last slot, dispatch capacity_reached event.
        // confirmedCount + 1 (the slot we're about to take) == capacity means full.
        if ($confirmedCount + 1 >= $locked->capacity) {
            $organizationId = $locked->workshop?->organization_id
                ?? Workshop::where('id', $locked->workshop_id)->value('organization_id');

            if ($organizationId) {
                try {
                    $this->webhookDispatcher->dispatch('session.capacity_reached', $organizationId, [
                        'session_id' => $locked->id,
                        'workshop_id' => $locked->workshop_id,
                        'session_title' => $locked->title,
                        'capacity' => $locked->capacity,
                        'reached_at' => now()->toIso8601String(),
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('EnforceSessionCapacityService: webhook dispatch failed', [
                        'session_id' => $locked->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
    }
}
