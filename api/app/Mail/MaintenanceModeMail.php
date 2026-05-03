<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MaintenanceModeMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $maintenanceMessage,
        public readonly ?string $endsAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '[Wayfield] Scheduled Maintenance Notice',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.maintenance-mode',
            with: [
                'firstName' => $this->user->first_name,
                'message'   => $this->maintenanceMessage,
                'endsAt'    => $this->endsAt,
                'statusUrl' => rtrim(config('app.frontend_url'), '/').'/status',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
