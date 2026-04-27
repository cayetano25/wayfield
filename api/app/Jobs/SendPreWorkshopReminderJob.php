<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-19: 7-day pre-workshop reminder email to all registered participants.
 * N-20: 24-hour pre-workshop reminder — also includes virtual join instructions.
 *
 * The notification_code on the ScheduledPaymentJob determines which copy is sent.
 */
class SendPreWorkshopReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int    $workshopId,
        private readonly string $notificationCode,
    ) {}

    public function handle(): void
    {
        $workshop = Workshop::with('organization', 'sessions')->find($this->workshopId);

        if (! $workshop) {
            Log::warning('SendPreWorkshopReminderJob: workshop not found', [
                'workshop_id'       => $this->workshopId,
                'notification_code' => $this->notificationCode,
            ]);
            return;
        }

        // Skip if workshop was cancelled or archived.
        if (in_array($workshop->status, ['archived', 'cancelled'], true)) {
            return;
        }

        $is24Hour = $this->notificationCode === 'N-20';
        $subject  = $is24Hour
            ? "Tomorrow: {$workshop->title} starts in 24 hours"
            : "{$workshop->title} is one week away";

        // Batch: one email per registered participant.
        $registrations = Registration::query()
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->with('user')
            ->get();

        foreach ($registrations as $registration) {
            $user = $registration->user;

            if (! $user) {
                continue;
            }

            $emailLog = EmailLog::create([
                'recipient_user_id'    => $user->id,
                'recipient_email'      => $user->email,
                'notification_code'    => $this->notificationCode,
                'subject'              => $subject,
                'template_name'        => $is24Hour ? 'workshops.pre-reminder-24h' : 'workshops.pre-reminder-7day',
                'provider'             => 'ses',
                'status'               => 'queued',
                'related_entity_type'  => 'workshop',
                'related_entity_id'    => $workshop->id,
                'metadata_json'        => [
                    'registration_id' => $registration->id,
                    'is_24_hour'      => $is24Hour,
                ],
            ]);

            Log::info('SendPreWorkshopReminderJob: email queued', [
                'notification_code' => $this->notificationCode,
                'workshop_id'       => $workshop->id,
                'user_id'           => $user->id,
            ]);

            $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
        }
    }
}
