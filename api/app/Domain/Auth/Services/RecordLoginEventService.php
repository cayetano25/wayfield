<?php

namespace App\Domain\Auth\Services;

use App\Models\LoginEvent;
use App\Models\User;
use Illuminate\Http\Request;

class RecordLoginEventService
{
    /**
     * Record a login attempt in login_events.
     *
     * outcome values:
     *   success   — authenticated successfully
     *   failed    — wrong password or unknown email
     *   unverified — email not yet verified
     *   inactive  — account is disabled
     *
     * Called from LoginUserAction for all success and failure paths.
     * The table has no updated_at column (append-only audit trail).
     *
     * @param  User|null  $user  Resolved user model, or null for unknown-email failures
     * @param  string  $outcome  One of: success, failed, unverified, inactive
     * @param  string  $emailAttempted  The email address that was submitted
     */
    public function record(
        ?User $user,
        string $outcome,
        ?Request $request = null,
        string $emailAttempted = '',
    ): LoginEvent {
        return LoginEvent::create([
            'user_id' => $user?->id,
            'email_attempted' => $emailAttempted ?: ($user?->email ?? ''),
            'outcome' => $outcome,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'platform' => $request?->input('platform', 'unknown'),
        ]);
    }
}
