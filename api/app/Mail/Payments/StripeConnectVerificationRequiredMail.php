<?php

namespace App\Mail\Payments;

use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-43: Sent when a capability becomes inactive due to pending Stripe requirements.
class StripeConnectVerificationRequiredMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Organization $organization,
        public readonly string $capabilityId,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Verification required for '.$this->organization->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.stripe-connect-verification-required',
            with: [
                'orgName'        => $this->organization->name,
                'capabilityId'   => $this->capabilityId,
                'dashboardUrl'   => config('app.frontend_url').'/admin/settings/payments',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
