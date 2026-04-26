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

// N-34: Urgent notification sent to org owner/admin when a payment dispute is opened.
class DisputeOpenedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Dispute $dispute,
        public readonly Order $order,
        public readonly User $recipient,
    ) {}

    public function envelope(): Envelope
    {
        $dueBy = $this->dispute->evidence_due_by?->format('F j, Y') ?? 'soon';

        return new Envelope(
            subject: "⚠ Payment dispute received — action required by {$dueBy}",
        );
    }

    public function content(): Content
    {
        $stripeDisputeId  = $this->dispute->stripe_dispute_id;
        $stripeDashboard  = "https://dashboard.stripe.com/disputes/{$stripeDisputeId}";

        return new Content(
            view: 'mail.payments.dispute-opened',
            with: [
                'dispute'            => $this->dispute,
                'order'              => $this->order,
                'recipient'          => $this->recipient,
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
