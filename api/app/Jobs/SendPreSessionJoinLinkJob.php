<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-21: Send join link 1 hour before a virtual or hybrid session starts.
 *
 * Only fires for sessions with delivery_type IN ('virtual', 'hybrid').
 * Sends to participants who have selected this session.
 * The meeting_url is included in this email — this is its primary delivery vector.
 * Meeting URLs are never in offline sync packages or public endpoints.
 */
class SendPreSessionJoinLinkJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $sessionId,
    ) {}

    public function handle(): void
    {
        $session = Session::with('workshop')->find($this->sessionId);

        if (! $session) {
            Log::warning('SendPreSessionJoinLinkJob: session not found', [
                'session_id' => $this->sessionId,
            ]);
            return;
        }

        // Only send for virtual / hybrid sessions.
        if (! in_array($session->delivery_type, ['virtual', 'hybrid'], true)) {
            return;
        }

        // No meeting URL — nothing to send.
        if (empty($session->meeting_url)) {
            Log::warning('SendPreSessionJoinLinkJob: no meeting_url on session', [
                'session_id'   => $this->sessionId,
                'delivery_type' => $session->delivery_type,
            ]);
            return;
        }

        $workshop = $session->workshop;

        // Skip if workshop was cancelled/archived.
        if (in_array($workshop->status, ['archived', 'cancelled'], true)) {
            return;
        }

        // Start time formatted in the workshop's timezone.
        $startLocal = $session->start_at->setTimezone($workshop->timezone ?? 'UTC');

        $subject = "Join link for {$session->title} — starts at {$startLocal->format('g:i A T')}";

        // Fetch participants with an active selection for this session.
        $selections = SessionSelection::query()
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->with('registration.user')
            ->get();

        foreach ($selections as $selection) {
            $user = $selection->registration?->user;

            if (! $user) {
                continue;
            }

            // Validate participant is still registered.
            if ($selection->registration?->registration_status !== 'registered') {
                continue;
            }

            $emailLog = EmailLog::create([
                'recipient_user_id'    => $user->id,
                'recipient_email'      => $user->email,
                'notification_code'    => 'N-21',
                'subject'              => $subject,
                'template_name'        => 'sessions.join-link',
                'provider'             => 'ses',
                'status'               => 'queued',
                'related_entity_type'  => 'session',
                'related_entity_id'    => $session->id,
                'metadata_json'        => [
                    'meeting_url'          => $session->meeting_url,
                    'meeting_id'           => $session->meeting_id ?? null,
                    'meeting_passcode'     => $session->meeting_passcode ?? null,
                    'meeting_instructions' => $session->meeting_instructions ?? null,
                    'start_time_local'     => $startLocal->toIso8601String(),
                ],
            ]);

            Log::info('SendPreSessionJoinLinkJob: N-21 queued', [
                'session_id' => $session->id,
                'user_id'    => $user->id,
            ]);

            $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
        }
    }
}
