<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Scheduled Maintenance — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        <div style="display: inline-block; background: #E67E22; color: #fff; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
            Maintenance
        </div>

        <h1 style="color: #2E2E2E; font-size: 22px; margin: 0 0 16px;">Scheduled Maintenance Notice</h1>

        @if ($firstName)
            <p>Hi {{ $firstName }},</p>
        @else
            <p>Hi there,</p>
        @endif

        <p>We wanted to let you know that Wayfield will be temporarily unavailable for scheduled maintenance.</p>

        <div style="background: #FFF7ED; border-left: 4px solid #E67E22; padding: 16px 20px; border-radius: 0 6px 6px 0; margin: 20px 0;">
            <p style="margin: 0; font-weight: 600;">During this time:</p>
            <p style="margin: 8px 0 0;">{{ $message }}</p>
        </div>

        @if ($endsAt)
            <p><strong>Expected completion:</strong> {{ \Carbon\Carbon::parse($endsAt)->format('F j, Y \a\t g:i A T') }}</p>
        @endif

        <p>Workshops, schedules, and all participant data will be safe and untouched. We apologize for any inconvenience.</p>

        <div style="text-align: center; margin: 32px 0;">
            <a href="{{ $statusUrl }}"
               style="background: #0FA3B1; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                Check Status
            </a>
        </div>

        <p style="font-size: 13px; color: #6B7280; margin-top: 32px;">
            Wayfield &mdash; <a href="https://wayfieldapp.com" style="color: #0FA3B1;">wayfieldapp.com</a>
        </p>
    </div>
</body>
</html>
