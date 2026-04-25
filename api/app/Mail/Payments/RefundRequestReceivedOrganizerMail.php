<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\RefundRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-27: Sent to org owner/admin when a participant submits a refund request.
class RefundRequestReceivedOrganizerMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly RefundRequest $refundRequest,
        public readonly User $recipient,
    ) {}

    public function envelope(): Envelope
    {
        $orderNumber = $this->refundRequest->order?->order_number ?? '';

        return new Envelope(
            subject: "Refund request received for order {$orderNumber}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.refund-request-received-organizer',
            with: [
                'refundRequest' => $this->refundRequest,
                'order'         => $this->refundRequest->order,
                'recipient'     => $this->recipient,
                'reviewUrl'     => config('app.frontend_url')
                    . '/admin/refunds/' . $this->refundRequest->id,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
