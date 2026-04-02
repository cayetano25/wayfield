<?php

namespace App\Domain\Sync\Services;

use App\Domain\Attendance\Actions\LeaderCheckInAction;
use App\Domain\Attendance\Actions\MarkNoShowAction;
use App\Domain\Attendance\Actions\SelfCheckInAction;
use App\Domain\Attendance\Exceptions\AttendanceEligibilityException;
use App\Domain\Sync\Exceptions\InvalidOfflineActionException;
use App\Models\OfflineActionQueue;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Idempotently replay offline actions submitted by a reconnecting mobile client.
 *
 * Idempotency contract (enforced by UNIQUE(client_action_uuid)):
 *   1. If client_action_uuid exists AND processed_at is not null → already done, return success.
 *   2. If client_action_uuid exists AND processed_at is null → process it now.
 *   3. If client_action_uuid does not exist → insert and process.
 *
 * A duplicate submission of the same client_action_uuid will NEVER create a
 * duplicate attendance_records row.
 */
class ReplayOfflineActionsService
{
    public function __construct(
        private readonly SelfCheckInAction   $selfCheckIn,
        private readonly LeaderCheckInAction $leaderCheckIn,
        private readonly MarkNoShowAction    $markNoShow,
    ) {}

    /**
     * @param  array<array{client_action_uuid: string, action_type: string, payload: array}>  $actions
     * @return array<string, array{status: string, message: string}>  Keyed by client_action_uuid
     */
    public function replay(User $user, Workshop $workshop, array $actions): array
    {
        $results = [];

        foreach ($actions as $action) {
            $uuid       = $action['client_action_uuid'] ?? null;
            $actionType = $action['action_type'] ?? null;
            $payload    = $action['payload'] ?? [];

            if (! $uuid) {
                continue;
            }

            $results[$uuid] = $this->replayOne($user, $workshop, $uuid, $actionType, $payload);
        }

        return $results;
    }

    private function replayOne(
        User     $user,
        Workshop $workshop,
        string   $uuid,
        ?string  $actionType,
        array    $payload,
    ): array {
        // Step 1: check for existing record
        $queued = OfflineActionQueue::where('client_action_uuid', $uuid)->first();

        if ($queued && $queued->isProcessed()) {
            // Already successfully processed — idempotent success
            return ['status' => 'already_processed', 'message' => 'Action was already applied.'];
        }

        return DB::transaction(function () use ($user, $workshop, $uuid, $actionType, $payload, $queued) {
            // Step 2 or 3: insert if new, or use existing unprocessed row
            if (! $queued) {
                // Use insertOrIgnore in case a race on the same UUID slips through
                DB::table('offline_action_queue')->insertOrIgnore([
                    'user_id'            => $user->id,
                    'workshop_id'        => $workshop->id,
                    'action_type'        => $actionType,
                    'client_action_uuid' => $uuid,
                    'payload_json'       => json_encode($payload),
                    'processed_at'       => null,
                    'created_at'         => now(),
                    'updated_at'         => now(),
                ]);

                // Re-fetch to get the lock
                $queued = OfflineActionQueue::where('client_action_uuid', $uuid)->lockForUpdate()->first();

                if (! $queued) {
                    // Race lost — the concurrent inserter will process it
                    return ['status' => 'already_processed', 'message' => 'Action was already applied.'];
                }
            }

            if ($queued->isProcessed()) {
                return ['status' => 'already_processed', 'message' => 'Action was already applied.'];
            }

            // Step 4: dispatch the action
            try {
                $this->dispatchAction($user, $actionType, $payload);
            } catch (AttendanceEligibilityException | InvalidOfflineActionException $e) {
                return ['status' => 'rejected', 'message' => $e->getMessage()];
            } catch (AuthorizationException $e) {
                return ['status' => 'unauthorized', 'message' => $e->getMessage()];
            } catch (Throwable $e) {
                return ['status' => 'error', 'message' => 'Action could not be processed.'];
            }

            // Mark processed
            $queued->update(['processed_at' => now()]);

            return ['status' => 'applied', 'message' => 'Action applied successfully.'];
        });
    }

    private function dispatchAction(User $user, ?string $actionType, array $payload): void
    {
        match ($actionType) {
            'self_check_in' => $this->dispatchSelfCheckIn($user, $payload),
            'leader_check_in' => $this->dispatchLeaderCheckIn($user, $payload),
            'attendance_override' => $this->dispatchAttendanceOverride($user, $payload),
            default => throw new InvalidOfflineActionException(
                "Unknown action type: {$actionType}"
            ),
        };
    }

    private function dispatchSelfCheckIn(User $user, array $payload): void
    {
        $session = $this->resolveSession($payload);
        $this->selfCheckIn->execute($user, $session);
    }

    private function dispatchLeaderCheckIn(User $user, array $payload): void
    {
        $session     = $this->resolveSession($payload);
        $participant = $this->resolveParticipant($payload);
        $this->leaderCheckIn->execute($user, $session, $participant);
    }

    private function dispatchAttendanceOverride(User $user, array $payload): void
    {
        $session     = $this->resolveSession($payload);
        $participant = $this->resolveParticipant($payload);

        $overrideTo = $payload['status'] ?? null;

        if ($overrideTo === 'no_show') {
            $this->markNoShow->execute($user, $session, $participant);
            return;
        }

        if ($overrideTo === 'checked_in') {
            $this->leaderCheckIn->execute($user, $session, $participant);
            return;
        }

        throw new InvalidOfflineActionException(
            "attendance_override requires a valid 'status' value (checked_in|no_show)."
        );
    }

    private function resolveSession(array $payload): Session
    {
        $sessionId = $payload['session_id'] ?? null;

        if (! $sessionId) {
            throw new InvalidOfflineActionException("Payload is missing 'session_id'.");
        }

        $session = Session::find($sessionId);

        if (! $session) {
            throw new InvalidOfflineActionException("Session {$sessionId} not found.");
        }

        return $session;
    }

    private function resolveParticipant(array $payload): User
    {
        $userId = $payload['participant_user_id'] ?? null;

        if (! $userId) {
            throw new InvalidOfflineActionException("Payload is missing 'participant_user_id'.");
        }

        $participant = User::find($userId);

        if (! $participant) {
            throw new InvalidOfflineActionException("User {$userId} not found.");
        }

        return $participant;
    }
}
