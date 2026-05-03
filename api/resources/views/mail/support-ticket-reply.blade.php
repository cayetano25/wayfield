<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Support Reply — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <h1 style="color: #0FA3B1; font-size: 22px; margin-bottom: 4px;">Wayfield Support</h1>
        <p style="color: #6B7280; font-size: 13px; margin-top: 0;">Re: {{ $ticket->subject }} &mdash; Ticket #{{ $ticket->id }}</p>

        @if ($firstName)
            <p>Hi {{ $firstName }},</p>
        @else
            <p>Hi there,</p>
        @endif

        <p>Our support team has replied to your ticket:</p>

        <div style="background: #F5F5F5; border-left: 4px solid #0FA3B1; padding: 16px 20px; border-radius: 0 6px 6px 0; margin: 20px 0;">
            {!! nl2br(e($message->body)) !!}
        </div>

        <p>If you have further questions, simply reply to this email or visit the help center.</p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{{ $helpUrl }}"
               style="background: #0FA3B1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                Visit Help Center
            </a>
        </div>

        <p style="font-size: 13px; color: #6B7280; margin-top: 32px;">
            Wayfield &mdash; <a href="https://wayfieldapp.com" style="color: #0FA3B1;">wayfieldapp.com</a>
        </p>
    </div>
</body>
</html>
