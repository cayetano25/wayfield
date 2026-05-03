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
        $preheader = mb_substr(strip_tags($this->announcement->message), 0, 90);

        return new Content(
            view: 'emails.system-announcement',
            text: 'emails.system-announcement-text',
            with: [
                'firstName'    => $this->user->first_name,
                'announcement' => $this->announcement,
                'preheader'    => $preheader,
                'dashboardUrl' => rtrim(config('app.frontend_url'), '/').'/admin',
                'settingsUrl'  => rtrim(config('app.frontend_url'), '/').'/admin/settings/notifications',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
