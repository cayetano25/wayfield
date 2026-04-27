<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\Dispute;
use App\Domain\Payments\Models\Order;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-36: 3-day warning before dispute evidence deadline.
class DisputeEvidenceReminderMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Dispute $dispute,
        public readonly Order $order,
        public readonly User $recipient,
        public readonly int $daysRemaining,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "⏰ {$this->daysRemaining} days left to respond to dispute — #{$this->order->order_number}",
        );
    }

    public function content(): Content
    {
        $stripeDisputeId  = $this->dispute->stripe_dispute_id;
        $stripeDashboard  = "https://dashboard.stripe.com/disputes/{$stripeDisputeId}";

        return new Content(
            view: 'mail.payments.dispute-evidence-reminder',
            with: [
                'dispute'            => $this->dispute,
                'order'              => $this->order,
                'recipient'          => $this->recipient,
                'daysRemaining'      => $this->daysRemaining,
                'evidenceDueBy'      => $this->dispute->evidence_due_by?->toIso8601String(),
                'stripeDashboardUrl' => $stripeDashboard,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
