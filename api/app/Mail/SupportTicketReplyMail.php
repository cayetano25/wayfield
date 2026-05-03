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
            from: new Address('support@wayfieldapp.com', 'Wayfield Support'),
            replyTo: [new Address('support@wayfieldapp.com', 'Wayfield Support')],
            subject: "Re: {$this->ticket->subject} [Ticket #{$this->ticket->id}]",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.support-ticket-reply',
            with: [
                'ticket'    => $this->ticket,
                'message'   => $this->message,
                'firstName' => $this->ticket->submittedBy?->first_name,
                'helpUrl'   => rtrim(config('app.frontend_url'), '/').'/help',
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
