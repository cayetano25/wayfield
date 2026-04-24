<?php

namespace App\Mail\Payments;

use App\Domain\Payments\Models\StripeConnectAccount;
use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-45: Sent when Stripe Connect onboarding reaches charges_enabled + payouts_enabled.
class StripeConnectOnboardingCompleteMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Organization $organization,
        public readonly StripeConnectAccount $account,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Payments are now enabled for '.$this->organization->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.stripe-connect-onboarding-complete',
            with: [
                'orgName'      => $this->organization->name,
                'dashboardUrl' => config('app.frontend_url').'/admin/settings/payments',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
