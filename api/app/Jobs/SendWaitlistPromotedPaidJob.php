<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Domain\Payments\Models\WaitlistPromotionPayment;
use App\Mail\Payments\WaitlistPromotedMail;
use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * N-13: Notify participant they've been promoted from the waitlist
 * and have 48 hours to complete payment.
 */
class SendWaitlistPromotedPaidJob implements ShouldQueue
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
            Log::warning('SendWaitlistPromotedPaidJob: promotion payment not found', [
                'promotion_payment_id' => $this->promotionPaymentId,
            ]);
            return;
        }

        // Guard: window may have already expired or payment completed.
        if (! in_array($promotionPayment->status, ['window_open'], true)) {
            return;
        }

        $user     = $promotionPayment->user;
        $workshop = $promotionPayment->workshop;

        if (! $user || ! $workshop) {
            return;
        }

        $expiresAt      = $promotionPayment->window_expires_at;
        $hoursRemaining = (int) max(0, now()->diffInHours($expiresAt, false));

        // In-app notification.
        Notification::create([
            'organization_id'       => $workshop->organization_id,
            'workshop_id'           => $workshop->id,
            'created_by_user_id'    => null,
            'title'                 => 'You\'ve been promoted from the waitlist!',
            'message'               => "A spot has opened in {$workshop->title}. You have {$hoursRemaining} hours to complete your payment.",
            'notification_type'     => 'urgent',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);

        // Email log record.
        $emailLog = EmailLog::create([
            'recipient_user_id'    => $user->id,
            'recipient_email'      => $user->email,
            'notification_code'    => 'N-13',
            'subject'              => "You're off the waitlist — {$workshop->title}!",
            'template_name'        => 'payments.waitlist-promoted',
            'provider'             => 'ses',
            'status'               => 'queued',
            'related_entity_type'  => 'waitlist_promotion_payment',
            'related_entity_id'    => $promotionPayment->id,
        ]);

        Mail::to($user->email)->queue(new WaitlistPromotedMail($promotionPayment, $user));

        Log::info('SendWaitlistPromotedPaidJob: N-13 sent', [
            'promotion_payment_id' => $promotionPayment->id,
            'user_id'              => $user->id,
            'workshop_id'          => $workshop->id,
            'window_expires_at'    => $expiresAt->toIso8601String(),
        ]);

        $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
    }
}
