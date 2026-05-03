[Wayfield] {{ $announcement->title }}
{{ str_repeat('=', min(60, strlen($announcement->title) + 11)) }}

@if ($firstName)
Hi {{ $firstName }},
@else
Hi there,
@endif

{{ $announcement->message }}

@if ($announcement->ends_at)
This notice is active until {{ $announcement->ends_at->format('F j, Y \a\t g:i A T') }}.
@endif

─────────────────────────────────────
Go to your dashboard: {{ $dashboardUrl }}

You're receiving this because you're an organizer on Wayfield.
Manage notification preferences: {{ $settingsUrl }}
wayfieldapp.com
