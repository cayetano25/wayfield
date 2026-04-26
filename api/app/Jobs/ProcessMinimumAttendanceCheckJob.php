<?php

namespace App\Jobs;

use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Notification;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-53: Check minimum attendance on the commitment date.
 *
 * Sends an in-app + email warning to the organizer if registration count
 * falls below the minimum_attendance threshold. Does NOT automatically
 * cancel the workshop — that decision belongs to the organizer.
 */
class ProcessMinimumAttendanceCheckJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $workshopId,
    ) {}

    public function handle(): void
    {
        $workshop = Workshop::with('organization')->find($this->workshopId);

        if (! $workshop) {
            Log::warning('ProcessMinimumAttendanceCheckJob: workshop not found', [
                'workshop_id' => $this->workshopId,
            ]);
            return;
        }

        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        if (! $pricing || ! $pricing->minimum_attendance) {
            return;
        }

        $minimum         = (int) $pricing->minimum_attendance;
        $registeredCount = Registration::query()
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->count();

        if ($registeredCount >= $minimum) {
            // Minimum met — no action needed.
            return;
        }

        $waitlistedCount = Registration::query()
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'waitlisted')
            ->count();

        $message = "Warning: Only {$registeredCount} of {$minimum} minimum participants are registered for {$workshop->title}. "
            . ($waitlistedCount > 0
                ? "There are {$waitlistedCount} participant(s) on the waitlist. "
                : '')
            . "Consider reaching out to waitlisted participants or evaluating whether to proceed with the workshop.";

        // In-app notification to organizer.
        Notification::create([
            'organization_id'       => $workshop->organization_id,
            'workshop_id'           => $workshop->id,
            'created_by_user_id'    => null,
            'title'                 => "Minimum attendance not met — {$workshop->title}",
            'message'               => $message,
            'notification_type'     => 'urgent',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);

        Log::warning('ProcessMinimumAttendanceCheckJob: N-53 minimum not met', [
            'workshop_id'      => $this->workshopId,
            'registered_count' => $registeredCount,
            'minimum'          => $minimum,
        ]);
    }
}
