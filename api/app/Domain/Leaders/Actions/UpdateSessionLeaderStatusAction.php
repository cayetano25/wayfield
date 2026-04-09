<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class UpdateSessionLeaderStatusAction
{
    /**
     * Update the assignment_status of an existing session_leader record.
     *
     * Valid transitions an organizer may perform:
     *   accepted  → removed
     *   pending   → accepted | declined | removed
     *
     * Leaders accepting/declining their own assignment call this with
     * the appropriate status ('accepted' or 'declined').
     *
     * @param  string  $status  One of: pending, accepted, declined, removed
     *
     * @throws \InvalidArgumentException if status is invalid
     * @throws ModelNotFoundException if not found
     */
    public function execute(
        Session $session,
        Leader $leader,
        User $actor,
        string $status,
    ): SessionLeader {
        $validStatuses = ['pending', 'accepted', 'declined', 'removed'];

        if (! in_array($status, $validStatuses)) {
            throw new \InvalidArgumentException(
                "Invalid assignment_status '{$status}'. Must be one of: ".implode(', ', $validStatuses)
            );
        }

        $sessionLeader = SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->firstOrFail();

        $previousStatus = $sessionLeader->assignment_status;

        // If moving away from primary or to removed/declined, clear the is_primary flag
        if (in_array($status, ['removed', 'declined']) && $sessionLeader->is_primary) {
            $sessionLeader->is_primary = false;
        }

        $sessionLeader->assignment_status = $status;
        $sessionLeader->save();

        AuditLogService::record([
            'organization_id' => $session->workshop->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'session_leader',
            'entity_id' => $sessionLeader->id,
            'action' => 'leader_assignment_status_updated',
            'metadata' => [
                'leader_id' => $leader->id,
                'session_id' => $session->id,
                'previous_status' => $previousStatus,
                'new_status' => $status,
            ],
        ]);

        return $sessionLeader;
    }
}
