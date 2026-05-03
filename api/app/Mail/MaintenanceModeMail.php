<?php

namespace App\Mail;

use App\Models\User;
use Carbon\Carbon;
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
        public readonly ?string $startsAt,
        public readonly ?string $endsAt,
    ) {}

    public function envelope(): Envelope
    {
        $formattedDate = $this->startsAt
            ? Carbon::parse($this->startsAt)->format('D, M j')  // e.g. "Wed, May 14"
            : 'Scheduled';

        return new Envelope(
            subject: "[Action: Save Your Work] Wayfield Maintenance — {$formattedDate}",
        );
    }

    public function content(): Content
    {
        $startsAt = $this->startsAt ? Carbon::parse($this->startsAt) : null;
        $endsAt   = $this->endsAt   ? Carbon::parse($this->endsAt)   : null;

        $duration = null;
        if ($startsAt && $endsAt) {
            $minutes = (int) $startsAt->diffInMinutes($endsAt);
            $duration = $minutes < 60
                ? "approximately {$minutes} minutes"
                : 'approximately '.round($minutes / 60, 1).' hour(s)';
        }

        $preheader = 'Wayfield will be briefly unavailable'
            .($startsAt ? ' starting '.$startsAt->format('g:i A T') : '')
            .'. All your data is safe.';

        return new Content(
            view: 'emails.maintenance-mode',
            text: 'emails.maintenance-mode-text',
            with: [
                'firstName'   => $this->user->first_name,
                'bodyMessage' => $this->maintenanceMessage,
                'startsAt'    => $startsAt,
                'endsAt'      => $endsAt,
                'duration'    => $duration,
                'preheader'   => $preheader,
                'helpUrl'     => rtrim(config('app.frontend_url'), '/').'/help',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
