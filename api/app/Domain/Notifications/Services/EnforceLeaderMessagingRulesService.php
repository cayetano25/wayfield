<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Notifications\Exceptions\LeaderMessagingScopeException;
use App\Domain\Notifications\Exceptions\LeaderMessagingWindowException;
use App\Models\Leader;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use Carbon\Carbon;
use DateTimeZone;

class EnforceLeaderMessagingRulesService
{
    /**
     * Validate that a leader user is allowed to send a notification for a session.
     *
     * Checks:
     * 1. The user is linked to a leader profile.
     * 2. That leader is explicitly assigned to the session via session_leaders.
     * 3. The current time (in the workshop's timezone) falls within the allowed window:
     *    [session.start_at - 4 hours, session.end_at + 2 hours]
     *
     * The window is computed in the workshop's configured timezone, NOT in UTC.
     *
     * @throws LeaderMessagingScopeException if the leader is not assigned to this session
     * @throws LeaderMessagingWindowException if the current time is outside the allowed window
     */
    public function enforce(User $user, Session $session): Leader
    {
        // 1. Resolve leader profile
        $leader = Leader::where('user_id', $user->id)->first();

        if (! $leader) {
            throw new LeaderMessagingScopeException(
                'No leader profile is associated with your account.'
            );
        }

        // 2. Verify assignment to this specific session
        $isAssigned = SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->exists();

        if (! $isAssigned) {
            throw new LeaderMessagingScopeException(
                'You are not assigned to this session and cannot message its participants.'
            );
        }

        // 3. Verify time window — MUST be computed in the workshop's timezone
        $this->enforceTimeWindow($session);

        return $leader;
    }

    private function enforceTimeWindow(Session $session): void
    {
        // Load the workshop if not already loaded
        $session->loadMissing('workshop');

        $workshopTimezone = new DateTimeZone($session->workshop->timezone);

        // Convert session times to the workshop's configured timezone.
        // Carbon::parse() treats the stored value as UTC (MySQL default).
        // setTimezone() converts to the workshop timezone for window math.
        $sessionStart = Carbon::parse($session->start_at)->setTimezone($workshopTimezone);
        $sessionEnd = Carbon::parse($session->end_at)->setTimezone($workshopTimezone);

        $windowStart = $sessionStart->copy()->subHours(4);
        $windowEnd = $sessionEnd->copy()->addHours(2);

        // Current time in the same timezone for an apples-to-apples comparison.
        $now = Carbon::now($workshopTimezone);

        if ($now->lt($windowStart) || $now->gt($windowEnd)) {
            throw new LeaderMessagingWindowException(
                sprintf(
                    'Messaging for this session is only allowed between %s and %s (%s).',
                    $windowStart->toDateTimeString(),
                    $windowEnd->toDateTimeString(),
                    $session->workshop->timezone
                )
            );
        }
    }
}
