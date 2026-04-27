<?php

namespace App\Mail\Payments;

use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-42: Urgent — sent when Stripe account is deauthorized (account.application.deauthorized).
class StripeConnectDeauthorizedMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Organization $organization,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Action required: Stripe account disconnected for '.$this->organization->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.stripe-connect-deauthorized',
            with: [
                'orgName'     => $this->organization->name,
                'reconnectUrl' => config('app.frontend_url').'/admin/settings/payments',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
