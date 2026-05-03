[Action: Save Your Work] Wayfield Scheduled Maintenance
========================================================

@if ($firstName)
Hi {{ $firstName }},
@else
Hi there,
@endif

We're letting you know about an upcoming planned maintenance window.
Please save any work in progress before it begins.

MAINTENANCE WINDOW DETAILS
---------------------------
@if ($startsAt)
Date:         {{ $startsAt->format('l, F j, Y') }}
Start:        {{ $startsAt->format('g:i A T') }}
@endif
@if ($duration)
Duration:     {{ $duration }}
@endif
@if ($endsAt)
Expected back: {{ $endsAt->format('g:i A T') }}
@endif

WHAT THIS MEANS FOR YOU
------------------------
- The Wayfield web admin will be unavailable during this window
- Participant check-in and session selection will be temporarily offline
- Any work in progress should be saved before the window begins
- All your data is safe — this is a planned infrastructure update

WHAT YOU SHOULD DO
-------------------
- Complete any time-sensitive actions before maintenance begins
- Inform your participants if your workshop runs during this window
- The app will resume automatically when maintenance is complete

@if ($bodyMessage)
Additional notes:
{{ $bodyMessage }}

@endif

─────────────────────────────────────────────────────
Questions? Reply to this email or visit: {{ $helpUrl }}

You're receiving this because you're an organizer on Wayfield.
wayfieldapp.com
