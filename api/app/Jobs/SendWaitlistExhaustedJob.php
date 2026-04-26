<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\Organization;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-18: In-app notification to organizer that the waitlist is exhausted
 * — no more participants are waiting to fill the open spot.
 */
class SendWaitlistExhaustedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int $workshopId,
    ) {}

    public function handle(): void
    {
        $workshop = Workshop::find($this->workshopId);

        if (! $workshop) {
            Log::warning('SendWaitlistExhaustedJob: workshop not found', [
                'workshop_id' => $this->workshopId,
            ]);
            return;
        }

        Notification::create([
            'organization_id'       => $workshop->organization_id,
            'workshop_id'           => $workshop->id,
            'created_by_user_id'    => null,
            'title'                 => 'Waitlist exhausted',
            'message'               => "The waitlist for {$workshop->title} is now empty. No further participants will be automatically promoted when a spot opens.",
            'notification_type'     => 'informational',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);

        Log::info('SendWaitlistExhaustedJob: N-18 dispatched', [
            'workshop_id' => $this->workshopId,
        ]);
    }
}
