<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Leader;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Support\Facades\DB;

class RemoveLeaderFromWorkshopAction
{
    public function execute(Workshop $workshop, Leader $leader, User $actor): void
    {
        DB::transaction(function () use ($workshop, $leader, $actor) {
            $sessionIds = $workshop->sessions()->pluck('id');

            $removedSessionIds = SessionLeader::where('leader_id', $leader->id)
                ->whereIn('session_id', $sessionIds)
                ->pluck('session_id')
                ->toArray();

            // Preserve the workshop_leaders row for history; just unconfirm the leader.
            WorkshopLeader::where('workshop_id', $workshop->id)
                ->where('leader_id', $leader->id)
                ->update(['is_confirmed' => false]);

            // Mark the linked invitation removed if one exists for this workshop.
            $leader->invitations()
                ->where('workshop_id', $workshop->id)
                ->whereNotIn('status', ['removed', 'declined'])
                ->update(['status' => 'removed', 'responded_at' => now()]);

            // Delete all session assignments for this leader in this workshop.
            SessionLeader::where('leader_id', $leader->id)
                ->whereIn('session_id', $sessionIds)
                ->delete();

            AuditLogService::record([
                'organization_id' => $workshop->organization_id,
                'actor_user_id' => $actor->id,
                'entity_type' => 'workshop_leader',
                'entity_id' => $leader->id,
                'action' => 'leader_removed_from_workshop',
                'metadata' => [
                    'leader_id' => $leader->id,
                    'leader_name' => trim("{$leader->first_name} {$leader->last_name}"),
                    'workshop_id' => $workshop->id,
                    'workshop_title' => $workshop->title,
                    'sessions_removed_from' => $removedSessionIds,
                ],
            ]);
        });
    }
}
