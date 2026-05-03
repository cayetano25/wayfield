<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $announcement->title }} — Wayfield</title>
</head>
<body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2E2E2E; background: #F5F5F5; padding: 32px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px;">
        @php
            $colors = [
                'info' => '#7EA8BE',
                'warning' => '#F59E0B',
                'maintenance' => '#E67E22',
                'outage' => '#E94F37',
                'update' => '#0FA3B1',
            ];
            $badgeColor = $colors[$announcement->announcement_type] ?? '#0FA3B1';
        @endphp

        <div style="display: inline-block; background: {{ $badgeColor }}; color: #fff; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
            {{ $announcement->announcement_type }}
        </div>

        <h1 style="color: #2E2E2E; font-size: 22px; margin: 0 0 16px;">{{ $announcement->title }}</h1>

        @if ($firstName)
            <p>Hi {{ $firstName }},</p>
        @else
            <p>Hi there,</p>
        @endif

        <div style="line-height: 1.6; margin: 16px 0;">
            {!! nl2br(e($announcement->message)) !!}
        </div>

        @if ($announcement->ends_at)
            <p style="font-size: 13px; color: #6B7280;">
                This notice is active until {{ $announcement->ends_at->format('F j, Y \a\t g:i A T') }}.
            </p>
        @endif

        <p style="font-size: 13px; color: #6B7280; margin-top: 32px;">
            Wayfield &mdash; <a href="https://wayfieldapp.com" style="color: #0FA3B1;">wayfieldapp.com</a>
        </p>
    </div>
</body>
</html>
