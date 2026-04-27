<?php

namespace App\Mail\Payments;

use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-41: Sent when a payout to the org's bank account fails (payout.failed).
class StripeConnectPayoutFailedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Organization $organization,
        public readonly string $failureMessage,
        public readonly ?int $amountCents = null,
        public readonly ?string $currency = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Payout failed for '.$this->organization->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.stripe-connect-payout-failed',
            with: [
                'orgName'        => $this->organization->name,
                'failureMessage' => $this->failureMessage,
                'amountCents'    => $this->amountCents,
                'currency'       => $this->currency,
                'dashboardUrl'   => config('app.frontend_url').'/admin/settings/payments',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
