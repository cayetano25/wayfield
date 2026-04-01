<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmailVerificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public readonly string $verifyUrl;

    public function __construct(
        public readonly User $user,
    ) {
        $this->verifyUrl = url(sprintf(
            '/api/v1/auth/verify-email/%s/%s',
            $this->user->id,
            sha1($this->user->email)
        ));
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Verify Your Email Address',
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.email-verification',
            with: [
                'user'      => $this->user,
                'verifyUrl' => $this->verifyUrl,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
