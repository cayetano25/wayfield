<?php

namespace App\Jobs;

use App\Mail\SupportTicketReplyMail;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendSupportTicketReplyJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $ticketId,
        public readonly int $messageId,
    ) {}

    public function handle(): void
    {
        $ticket = SupportTicket::with('submittedBy')->find($this->ticketId);
        $message = SupportTicketMessage::find($this->messageId);

        if (! $ticket || ! $message || ! $ticket->submittedBy) {
            return;
        }

        // Only email the user for non-internal messages
        if ($message->is_internal) {
            return;
        }

        Mail::to($ticket->submittedBy->email)
            ->queue(new SupportTicketReplyMail($ticket, $message));
    }
}
