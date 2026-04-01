<?php

namespace App\Domain\Auth\Services;

use App\Models\LoginEvent;
use App\Models\User;
use Illuminate\Http\Request;

class RecordLoginEventService
{
    /**
     * Record a login attempt (successful or failed) in login_events.
     *
     * Called from LoginUserAction for both success and failure paths.
     * The table has no updated_at column (append-only audit trail).
     *
     * @param User|null $user  Resolved user model, or null for unknown-email failures
     * @param bool      $success
     * @param string    $failureReason  Short reason string for failed attempts
     */
    public function record(
        ?User $user,
        bool $success,
        ?Request $request = null,
        string $failureReason = '',
        string $emailAttempted = '',
    ): LoginEvent {
        return LoginEvent::create([
            'user_id'          => $user?->id,
            'email_attempted'  => $emailAttempted ?: ($user?->email ?? ''),
            'success'          => $success,
            'ip_address'       => $request?->ip(),
            'user_agent'       => $request?->userAgent(),
            'platform'         => $request?->input('platform', 'unknown'),
            'failure_reason'   => $success ? null : $failureReason,
        ]);
    }
}
