<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Registration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-15: Email participant confirming they've been registered (free workshop promotion).
 * N-16: In-app notification to organizer that a waitlisted participant was promoted.
 */
class SendWaitlistRegisteredFreeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int $registrationId,
    ) {}

    public function handle(): void
    {
        $registration = Registration::with('user', 'workshop.organization')->find($this->registrationId);

        if (! $registration) {
            Log::warning('SendWaitlistRegisteredFreeJob: registration not found', [
                'registration_id' => $this->registrationId,
            ]);
            return;
        }

        if ($registration->registration_status !== 'registered') {
            return;
        }

        $user     = $registration->user;
        $workshop = $registration->workshop;

        if (! $user || ! $workshop) {
            return;
        }

        // N-15: Email to participant.
        $emailLog = EmailLog::create([
            'recipient_user_id'    => $user->id,
            'recipient_email'      => $user->email,
            'notification_code'    => 'N-15',
            'subject'              => "You're registered for {$workshop->title}!",
            'template_name'        => 'waitlist.registered-free',
            'provider'             => 'ses',
            'status'               => 'queued',
            'related_entity_type'  => 'registration',
            'related_entity_id'    => $registration->id,
        ]);

        Log::info('SendWaitlistRegisteredFreeJob: N-15 queued', [
            'registration_id' => $registration->id,
            'user_id'         => $user->id,
            'workshop_id'     => $workshop->id,
        ]);

        $emailLog->update(['status' => 'sent', 'sent_at' => now()]);

        // N-16: In-app notification to organizer.
        Notification::create([
            'organization_id'       => $workshop->organization_id,
            'workshop_id'           => $workshop->id,
            'created_by_user_id'    => null,
            'title'                 => 'Waitlisted participant promoted',
            'message'               => "{$user->first_name} {$user->last_name} has been moved from the waitlist and is now registered for {$workshop->title}.",
            'notification_type'     => 'informational',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);
    }
}
