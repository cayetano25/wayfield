Re: {{ $ticket->subject }} [#{{ $ticket->id }}]
{{ str_repeat('=', 60) }}

@if ($firstName)
Hi {{ $firstName }},
@else
Hi there,
@endif

Our support team has replied to your request:

─────────────────────────────────────────
{{ $replyMessage->body }}

— Wayfield Support
─────────────────────────────────────────

View your ticket: {{ $ticketUrl }}

───────────────────────────────────────────────────────────
YOUR ORIGINAL MESSAGE:

{{ $originalBody }}

───────────────────────────────────────────────────────────
Ticket #{{ $ticket->id }} — submitted {{ $submittedAt->diffForHumans() }}
Reply to this email or visit your Wayfield dashboard for follow-up.
{{ $supportEmail }} — wayfieldapp.com
