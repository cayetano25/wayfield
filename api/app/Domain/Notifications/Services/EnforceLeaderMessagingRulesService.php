<?php

namespace App\Domain\Notifications\Services;

use App\Domain\Shared\Services\AuditLogService;
use App\Exceptions\LeaderMessagingDeniedException;
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
     * Checks (in order):
     * 1. The organisation's plan is Starter or higher.
     * 2. The user is linked to a leader profile.
     * 3. That leader is explicitly assigned to the session via session_leaders (accepted).
     * 4. The current time (in the workshop's timezone) falls within the allowed window:
     *    [session.start_at - 4 hours, session.end_at + 2 hours]
     *
     * The window is computed in the workshop's configured timezone, NOT in UTC.
     *
     * Writes an audit_logs record for BOTH allowed and denied attempts.
     *
     * @throws LeaderMessagingDeniedException on any denial
     *
     * @deprecated Use validate() — enforce() is kept for backwards compatibility.
     */
    public function enforce(User $user, Session $session): Leader
    {
        return $this->validate($user, $session);
    }

    /**
     * Validate that a leader user is allowed to send a notification for a session.
     *
     * @throws LeaderMessagingDeniedException on any denial
     */
    public function validate(User $user, Session $session): Leader
    {
        $session->loadMissing('workshop');
        $workshop = $session->workshop;

        // 1. Plan gate: Starter or higher required
        $subscription = $workshop->organization->subscription;
        $planCode = $subscription?->plan_code ?? 'foundation';

        if (in_array($planCode, ['foundation'], true)) {
            $this->auditDenied($user, $session, 'plan_required');
            throw LeaderMessagingDeniedException::planRequired();
        }

        // 2. Resolve leader profile
        $leader = Leader::where('user_id', $user->id)->first();

        if (! $leader) {
            $this->auditDenied($user, $session, 'no_leader_profile');
            throw LeaderMessagingDeniedException::notAssigned(
                'No leader profile is associated with your account.'
            );
        }

        // 3. Verify assignment to this specific session
        $isAssigned = SessionLeader::where('session_id', $session->id)
            ->where('leader_id', $leader->id)
            ->where('assignment_status', 'accepted')
            ->exists();

        if (! $isAssigned) {
            $this->auditDenied($user, $session, 'not_assigned', ['leader_id' => $leader->id]);
            throw LeaderMessagingDeniedException::notAssigned();
        }

        // 4. Verify time window — MUST be computed in the workshop's timezone
        $window = $this->getWindow($session);
        $now = Carbon::now(new DateTimeZone($workshop->timezone));

        if ($now->lt($window['start']) || $now->gt($window['end'])) {
            $this->auditDenied($user, $session, 'outside_window', ['leader_id' => $leader->id]);

            // Compute UTC window boundaries for the error response (start_at/end_at are stored UTC)
            $utcWindowStart = Carbon::parse($session->start_at, 'UTC')->subHours(4);
            $utcWindowEnd = Carbon::parse($session->end_at, 'UTC')->addHours(2);

            throw LeaderMessagingDeniedException::outsideWindow(
                'Notifications can only be sent within the messaging window for this session.',
                $utcWindowStart,
                $utcWindowEnd
            );
        }

        $this->auditAllowed($user, $session, $leader);

        return $leader;
    }

    /**
     * Return the messaging window boundaries for a session.
     *
     * Both timestamps are in the workshop's timezone.
     *
     * @return array{start: Carbon, end: Carbon}
     */
    public function getWindow(Session $session): array
    {
        $session->loadMissing('workshop');
        $workshopTimezone = new DateTimeZone($session->workshop->timezone);

        $sessionStart = Carbon::parse($session->start_at)->setTimezone($workshopTimezone);
        $sessionEnd = Carbon::parse($session->end_at)->setTimezone($workshopTimezone);

        return [
            'start' => $sessionStart->copy()->subHours(4),
            'end' => $sessionEnd->copy()->addHours(2),
        ];
    }

    private function auditDenied(User $user, Session $session, string $reason, array $extra = []): void
    {
        $session->loadMissing('workshop');
        $workshop = $session->workshop;

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $user->id,
            'entity_type' => 'session',
            'entity_id' => $session->id,
            'action' => 'leader_notification_denied',
            'metadata' => array_merge([
                'session_id' => $session->id,
                'workshop_id' => $workshop->id,
                'organization_id' => $workshop->organization_id,
                'denial_reason' => $reason,
            ], $extra),
        ]);
    }

    private function auditAllowed(User $user, Session $session, Leader $leader): void
    {
        $session->loadMissing('workshop');
        $workshop = $session->workshop;

        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $user->id,
            'entity_type' => 'session',
            'entity_id' => $session->id,
            'action' => 'leader_notification_allowed',
            'metadata' => [
                'leader_id' => $leader->id,
                'session_id' => $session->id,
                'workshop_id' => $workshop->id,
                'organization_id' => $workshop->organization_id,
            ],
        ]);
    }
}
