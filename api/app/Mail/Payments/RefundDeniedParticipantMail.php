<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\RefundRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-30: Sent to participant when their refund request is denied.
class RefundDeniedParticipantMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly RefundRequest $refundRequest,
    ) {}

    public function envelope(): Envelope
    {
        $orderNumber = $this->refundRequest->order?->order_number ?? '';

        return new Envelope(
            subject: "Update on your refund request for order {$orderNumber}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.refund-denied-participant',
            with: [
                'refundRequest' => $this->refundRequest,
                'order'         => $this->refundRequest->order,
                'reason'        => $this->refundRequest->review_notes,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
