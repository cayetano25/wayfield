<?php

namespace App\Mail;

use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkshopJoinConfirmationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly Workshop $workshop,
        public readonly Registration $registration,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'You\'ve joined '.$this->workshop->title,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.workshop-join-confirmation',
            with: [
                'user' => $this->user,
                'workshop' => $this->workshop,
                'registration' => $this->registration,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
