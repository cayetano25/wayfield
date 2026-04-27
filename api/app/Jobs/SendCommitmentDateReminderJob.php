<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-49: 7-day commitment date reminder — "Last chance for a full refund".
 * N-50: 48-hour commitment date reminder — urgent version.
 *
 * Sends to all registered participants for workshops with commitment_date set.
 */
class SendCommitmentDateReminderJob implements ShouldQueue
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
        $workshop = Workshop::find($this->workshopId);

        if (! $workshop) {
            Log::warning('SendCommitmentDateReminderJob: workshop not found', [
                'workshop_id'       => $this->workshopId,
                'notification_code' => $this->notificationCode,
            ]);
            return;
        }

        if (in_array($workshop->status, ['archived', 'cancelled'], true)) {
            return;
        }

        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        if (! $pricing || ! $pricing->commitment_date) {
            return;
        }

        $is48Hour        = $this->notificationCode === 'N-50';
        $commitmentDate  = $pricing->commitment_date->toFormattedDateString();
        $description     = $pricing->commitment_description ?? '';

        $subject = $is48Hour
            ? "Final 48 hours for a full refund on {$workshop->title}"
            : "Last chance for a full refund — {$workshop->title} commitment date in 7 days";

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
                'template_name'        => $is48Hour ? 'workshops.commitment-reminder-48h' : 'workshops.commitment-reminder-7day',
                'provider'             => 'ses',
                'status'               => 'queued',
                'related_entity_type'  => 'workshop',
                'related_entity_id'    => $workshop->id,
                'metadata_json'        => [
                    'registration_id'      => $registration->id,
                    'commitment_date'      => $commitmentDate,
                    'commitment_description' => $description,
                ],
            ]);

            Log::info('SendCommitmentDateReminderJob: reminder queued', [
                'notification_code' => $this->notificationCode,
                'workshop_id'       => $workshop->id,
                'user_id'           => $user->id,
            ]);

            $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
        }
    }
}
