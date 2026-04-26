<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\RefundPolicy;
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
        public readonly ?RefundPolicy $refundPolicy = null,
    ) {}

    public function envelope(): Envelope
    {
        $workshopTitle = $this->refundRequest->order?->items->first()?->workshop_title ?? 'a workshop';

        return new Envelope(
            subject: "Refund request for {$workshopTitle} — action required",
        );
    }

    public function content(): Content
    {
        $order         = $this->refundRequest->order;
        $workshopId    = $order?->items->first()?->workshop_id;
        $workshopTitle = $order?->items->first()?->workshop_title ?? 'your workshop';
        $reviewUrl     = config('app.frontend_url')
            . ($workshopId ? "/admin/workshops/{$workshopId}/orders?tab=refunds" : '/admin/refunds');

        return new Content(
            view: 'mail.payments.refund-request-received',
            with: [
                'refundRequest' => $this->refundRequest,
                'order'         => $order,
                'recipient'     => $this->recipient,
                'workshopTitle' => $workshopTitle,
                'refundPolicy'  => $this->refundPolicy,
                'reviewUrl'     => $reviewUrl,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
