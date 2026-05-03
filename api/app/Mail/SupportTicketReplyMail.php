<?php

namespace App\Mail;

use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SupportTicketReplyMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly SupportTicket $ticket,
        public readonly SupportTicketMessage $message,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            from: new Address(
                config('mail.support_from_address', 'support@wayfieldapp.com'),
                config('mail.support_from_name', 'Wayfield Support'),
            ),
            replyTo: [new Address(
                config('mail.support_from_address', 'support@wayfieldapp.com'),
                config('mail.support_from_name', 'Wayfield Support'),
            )],
            subject: "Re: {$this->ticket->subject} [#{$this->ticket->id}]",
        );
    }

    public function content(): Content
    {
        $preheader = mb_substr(strip_tags($this->message->body), 0, 120);

        return new Content(
            view: 'emails.support-ticket-reply',
            text: 'emails.support-ticket-reply-text',
            with: [
                'ticket'       => $this->ticket,
                'replyMessage' => $this->message,
                'firstName'    => $this->ticket->submittedBy?->first_name,
                'originalBody' => $this->ticket->body,
                'preheader'    => $preheader,
                'ticketUrl'    => rtrim(config('app.frontend_url'), '/').'/help?ticket='.$this->ticket->id,
                'supportEmail' => config('mail.support_from_address', 'support@wayfieldapp.com'),
                'submittedAt'  => $this->ticket->created_at,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
