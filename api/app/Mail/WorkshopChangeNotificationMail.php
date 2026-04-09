<?php

namespace App\Mail;

use App\Models\Notification;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkshopChangeNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $recipient,
        public readonly Workshop $workshop,
        public readonly Notification $notification,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->notification->title,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.workshop-change-notification',
            with: [
                'recipient' => $this->recipient,
                'workshop' => $this->workshop,
                'notification' => $this->notification,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
