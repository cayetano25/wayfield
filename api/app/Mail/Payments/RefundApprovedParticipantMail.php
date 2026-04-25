<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\RefundRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-28: Sent to participant when their refund request is approved.
// N-31: Reused when the approval is automatic.
class RefundApprovedParticipantMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly RefundRequest $refundRequest,
        public readonly bool $isAutomatic = false,
    ) {}

    public function envelope(): Envelope
    {
        $orderNumber = $this->refundRequest->order?->order_number ?? '';

        return new Envelope(
            subject: "Your refund for order {$orderNumber} has been approved",
        );
    }

    public function content(): Content
    {
        $approvedCents = $this->refundRequest->approved_amount_cents
            ?? $this->refundRequest->requested_amount_cents;

        return new Content(
            view: 'mail.payments.refund-approved-participant',
            with: [
                'refundRequest'  => $this->refundRequest,
                'order'          => $this->refundRequest->order,
                'approvedAmount' => '$' . number_format($approvedCents / 100, 2),
                'isAutomatic'    => $this->isAutomatic,
                'arrivalNote'    => 'Funds typically arrive in 3–5 business days depending on your bank.',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
