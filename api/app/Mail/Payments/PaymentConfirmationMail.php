<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\RefundPolicy;
use App\Domain\Payments\Models\WorkshopPricing;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-03: Paid order confirmation sent to participant after checkout.
class PaymentConfirmationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Order $order,
        public readonly ?WorkshopPricing $pricing = null,
        public readonly ?RefundPolicy $refundPolicy = null,
    ) {}

    public function envelope(): Envelope
    {
        $workshopTitle = $this->order->items->first()?->workshop_title ?? 'your workshop';

        return new Envelope(
            subject: "You're registered! Order #{$this->order->order_number}",
        );
    }

    public function content(): Content
    {
        $firstItem     = $this->order->items->first();
        $workshopTitle = $firstItem?->workshop_title ?? 'Your workshop';

        $workshop = $this->order->items->first()?->workshop;

        return new Content(
            view: 'mail.payments.payment-confirmation',
            with: [
                'order'               => $this->order,
                'workshopTitle'       => $workshopTitle,
                'pricing'             => $this->pricing,
                'refundPolicy'        => $this->refundPolicy,
                'startDate'           => $workshop?->start_date?->format('F j, Y'),
                'locationName'        => $workshop?->defaultLocation?->name,
                'isVirtual'           => false,
                'viewRegistrationUrl' => config('app.frontend_url') . '/my-workshops',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
