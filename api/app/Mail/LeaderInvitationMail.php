<?php

namespace App\Mail;

use App\Models\LeaderInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LeaderInvitationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /**
     * @param LeaderInvitation $invitation  The invitation record (token stored as hash only)
     * @param string           $rawToken    The raw token — included in the email link ONLY, never persisted
     */
    public function __construct(
        public readonly LeaderInvitation $invitation,
        public readonly string $rawToken,
    ) {}

    public function envelope(): Envelope
    {
        $orgName = $this->invitation->organization->name ?? 'an organization';

        return new Envelope(
            subject: "You've been invited to lead a workshop on Wayfield",
        );
    }

    public function content(): Content
    {
        // URL format: /leader-invitations/{id}/{rawToken}/accept
        // The ID is the non-secret lookup key; the raw token is the secret.
        // The backend resolves by ID then verifies with hash_equals().
        $base = config('app.frontend_url')
            . '/leader-invitations/' . $this->invitation->id . '/' . $this->rawToken;

        $acceptUrl  = $base . '/accept';
        $declineUrl = $base . '/decline';

        return new Content(
            view: 'mail.leader-invitation',
            with: [
                'invitation'  => $this->invitation,
                'acceptUrl'   => $acceptUrl,
                'declineUrl'  => $declineUrl,
                'orgName'     => $this->invitation->organization->name ?? 'an organization',
                'firstName'   => $this->invitation->invited_first_name,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
