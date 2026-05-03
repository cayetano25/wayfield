<?php

namespace App\Mail;

use App\Models\SystemAnnouncement;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SystemAnnouncementMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly SystemAnnouncement $announcement,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "[Wayfield] {$this->announcement->title}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.system-announcement',
            with: [
                'firstName'    => $this->user->first_name,
                'announcement' => $this->announcement,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
