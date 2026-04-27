<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\WaitlistPromotionPayment;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-13: Urgent notification sent to participant when promoted from the waitlist.
class WaitlistPromotedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly WaitlistPromotionPayment $promotionPayment,
        public readonly User $recipient,
    ) {}

    public function envelope(): Envelope
    {
        $workshopTitle = $this->promotionPayment->workshop?->title ?? 'your workshop';

        return new Envelope(
            subject: "You're off the waitlist — {$workshopTitle}!",
        );
    }

    public function content(): Content
    {
        $workshop    = $this->promotionPayment->workshop;
        $slug        = $workshop?->public_slug;
        $paymentUrl  = config('app.frontend_url') . "/waitlist-payment/{$slug}";
        $pricing     = $workshop
            ? WorkshopPricing::where('workshop_id', $workshop->id)->first()
            : null;

        return new Content(
            view: 'mail.payments.waitlist-promoted',
            with: [
                'firstName'       => $this->recipient->first_name,
                'workshopTitle'   => $workshop?->title ?? 'your workshop',
                'amountCents'     => (int) ($pricing?->base_price_cents ?? 0),
                'windowExpiresAt' => $this->promotionPayment->window_expires_at->toIso8601String(),
                'paymentUrl'      => $paymentUrl,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
