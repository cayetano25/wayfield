<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Domain\Payments\Models\WaitlistPromotionPayment;
use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-17: Notify participant their payment window expired and their spot
 * has been passed to the next person on the waitlist.
 */
class SendWaitlistSkippedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int $promotionPaymentId,
    ) {}

    public function handle(): void
    {
        $promotionPayment = WaitlistPromotionPayment::with('user', 'workshop')->find($this->promotionPaymentId);

        if (! $promotionPayment) {
            Log::warning('SendWaitlistSkippedJob: promotion payment not found', [
                'promotion_payment_id' => $this->promotionPaymentId,
            ]);
            return;
        }

        $user     = $promotionPayment->user;
        $workshop = $promotionPayment->workshop;

        if (! $user || ! $workshop) {
            return;
        }

        // In-app notification.
        Notification::create([
            'organization_id'       => $workshop->organization_id,
            'workshop_id'           => $workshop->id,
            'created_by_user_id'    => null,
            'title'                 => 'Your payment window has closed',
            'message'               => "Your reserved spot in {$workshop->title} has been passed to the next person on the waitlist because payment was not completed in time. You may rejoin the waitlist if another spot opens.",
            'notification_type'     => 'urgent',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);

        $emailLog = EmailLog::create([
            'recipient_user_id'    => $user->id,
            'recipient_email'      => $user->email,
            'notification_code'    => 'N-17',
            'subject'              => "Your spot in {$workshop->title} has been released",
            'template_name'        => 'waitlist.skipped',
            'provider'             => 'ses',
            'status'               => 'queued',
            'related_entity_type'  => 'waitlist_promotion_payment',
            'related_entity_id'    => $promotionPayment->id,
        ]);

        Log::info('SendWaitlistSkippedJob: N-17 queued', [
            'promotion_payment_id' => $promotionPayment->id,
            'user_id'              => $user->id,
        ]);

        $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
    }
}
