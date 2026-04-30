<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ContactFormMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $senderName,
        public readonly string $senderEmail,
        public readonly string $subject,
        public readonly string $body,
        public readonly string $submittedAt,
        public readonly string $ipAddress,
    ) {}

    public function envelope(): Envelope
    {
        $label = str_replace('_', ' ', ucwords($this->subject, '_'));

        return new Envelope(
            subject: "[Wayfield Contact] {$label}: {$this->senderName}",
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.contact-form',
            with: [
                'senderName'  => $this->senderName,
                'senderEmail' => $this->senderEmail,
                'subject'     => $this->subject,
                'body'        => $this->body,
                'submittedAt' => $this->submittedAt,
                'ipAddress'   => $this->ipAddress,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
