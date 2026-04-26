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
 * N-14: 24-hour reminder that the waitlist payment window is closing soon.
 */
class SendWaitlistWindowReminderJob implements ShouldQueue
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
            Log::warning('SendWaitlistWindowReminderJob: promotion payment not found', [
                'promotion_payment_id' => $this->promotionPaymentId,
            ]);
            return;
        }

        // Skip if already paid or window closed.
        if ($promotionPayment->payment_completed_at !== null || $promotionPayment->status !== 'window_open') {
            return;
        }

        if ($promotionPayment->window_expires_at->isPast()) {
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
            'title'                 => 'Payment reminder — 24 hours left',
            'message'               => "Your spot in {$workshop->title} expires in 24 hours. Complete your payment now to secure your place.",
            'notification_type'     => 'reminder',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);

        $emailLog = EmailLog::create([
            'recipient_user_id'    => $user->id,
            'recipient_email'      => $user->email,
            'notification_code'    => 'N-14',
            'subject'              => "Reminder: 24 hours left to claim your spot in {$workshop->title}",
            'template_name'        => 'waitlist.window-reminder',
            'provider'             => 'ses',
            'status'               => 'queued',
            'related_entity_type'  => 'waitlist_promotion_payment',
            'related_entity_id'    => $promotionPayment->id,
        ]);

        $promotionPayment->update(['reminder_sent_at' => now()]);

        Log::info('SendWaitlistWindowReminderJob: N-14 queued', [
            'promotion_payment_id' => $promotionPayment->id,
            'user_id'              => $user->id,
        ]);

        $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
    }
}
