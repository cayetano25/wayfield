<?php

namespace App\Mail;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Generic workshop notification email dispatched by SendEmailNotificationJob.
 * Used for organizer and leader notifications sent through the notification system.
 */
class WorkshopNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly Notification $notification,
        public readonly User $recipient,
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
                'recipient'    => $this->recipient,
                'workshop'     => $this->notification->workshop,
                'notification' => $this->notification,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
