<?php

namespace App\Mail\Payments;

use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

// N-47: Sent to org owner/admin users when Wayfield enables payments for their org.
class PaymentsEnabledForOrgMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Organization $organization,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Payments have been enabled for '.$this->organization->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.payments.payments-enabled-for-org',
            with: [
                'orgName'      => $this->organization->name,
                'setupUrl'     => config('app.frontend_url').'/admin/settings/payments',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
