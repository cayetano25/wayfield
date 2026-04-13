<?php

declare(strict_types=1);

namespace App\Mail;

use App\Models\OrganizationInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InviteOrgMemberMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    private const ROLE_DISPLAY = [
        'owner' => 'Owner',
        'admin' => 'Administrator',
        'staff' => 'Staff',
        'billing_admin' => 'Billing Administrator',
    ];

    private const ROLE_BULLETS = [
        'owner' => [
            'Full access to all workshops, sessions, and participants',
            'Manage organisation settings, members, and billing',
            'Transfer ownership and manage all organisation resources',
        ],
        'admin' => [
            'Full access to all workshops, sessions, and participants',
            'Invite leaders and manage organisation members',
            'View subscription status (billing read-only)',
        ],
        'staff' => [
            'Create and edit workshops, sessions, and tracks',
            'View rosters and manage attendance',
            'Send workshop and session notifications',
        ],
        'billing_admin' => [
            'View subscription plan and status',
            'Access invoices, billing history, and the Stripe billing portal',
            'Manage payment methods',
        ],
    ];

    /**
     * @param  OrganizationInvitation  $invitation  The invitation record (token stored as hash only)
     * @param  string  $rawToken  The raw token — included in the email link ONLY, never persisted
     */
    public function __construct(
        public readonly OrganizationInvitation $invitation,
        public readonly string $rawToken,
    ) {}

    public function envelope(): Envelope
    {
        $orgName = $this->invitation->organization->name ?? 'an organisation';

        return new Envelope(
            subject: "You've been invited to join {$orgName} on Wayfield",
        );
    }

    public function content(): Content
    {
        $base = rtrim(config('app.frontend_url'), '/').'/org-invitations/'.$this->rawToken;
        $acceptUrl = $base.'/accept';
        $declineUrl = $base.'/decline';

        $role = $this->invitation->role;
        $roleDisplay = self::ROLE_DISPLAY[$role] ?? ucfirst($role);
        $bullets = self::ROLE_BULLETS[$role] ?? [];

        $createdBy = $this->invitation->createdBy;
        $inviterName = $createdBy
            ? trim("{$createdBy->first_name} {$createdBy->last_name}")
            : 'Someone at '.$this->invitation->organization->name;

        return new Content(
            view: 'mail.org-member-invitation',
            with: [
                'invitation' => $this->invitation,
                'acceptUrl' => $acceptUrl,
                'declineUrl' => $declineUrl,
                'orgName' => $this->invitation->organization->name ?? 'an organisation',
                'firstName' => $this->invitation->invited_first_name,
                'roleDisplay' => $roleDisplay,
                'bullets' => $bullets,
                'inviterName' => $inviterName,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
