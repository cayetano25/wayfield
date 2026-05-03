<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>Scheduled Maintenance — Wayfield</title>
</head>
<body style="margin:0;padding:0;word-break:break-word;-webkit-font-smoothing:antialiased;background-color:#F5F5F5;">

{{-- Preheader --}}
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
{{ $preheader }}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
</div>

<div style="font-family:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;color:#2E2E2E;max-width:600px;margin:0 auto;padding:24px 16px;">

  {{-- Header --}}
  <div style="text-align:center;padding:24px 0 16px;">
    <span style="font-size:22px;font-weight:700;color:#0FA3B1;letter-spacing:-0.5px;">Wayfield</span>
  </div>

  {{-- Card --}}
  <div style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    {{-- Amber warning banner --}}
    <div style="background:#E67E22;padding:12px 32px;">
      <span style="color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
        &#9888; Scheduled Maintenance
      </span>
    </div>

    {{-- Body --}}
    <div style="padding:32px;">

      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;">
        Wayfield will be briefly unavailable
      </h1>

      @if ($firstName)
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Hi {{ $firstName }},</p>
      @else
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Hi there,</p>
      @endif

      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#374151;">
        We're letting you know about an upcoming planned maintenance window.
        Please save any work in progress before the window begins.
      </p>

      {{-- Summary box --}}
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:20px 24px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
          @if ($startsAt)
          <tr>
            <td style="padding:4px 0;color:#92400E;width:28px;vertical-align:top;">&#128197;</td>
            <td style="padding:4px 0;color:#92400E;font-weight:600;width:100px;vertical-align:top;">Date</td>
            <td style="padding:4px 0;color:#1A1A1A;vertical-align:top;">{{ $startsAt->format('l, F j, Y') }}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#92400E;vertical-align:top;">&#9200;</td>
            <td style="padding:4px 0;color:#92400E;font-weight:600;vertical-align:top;">Start</td>
            <td style="padding:4px 0;color:#1A1A1A;vertical-align:top;">{{ $startsAt->format('g:i A T') }}</td>
          </tr>
          @endif
          @if ($duration)
          <tr>
            <td style="padding:4px 0;color:#92400E;vertical-align:top;">&#9201;</td>
            <td style="padding:4px 0;color:#92400E;font-weight:600;vertical-align:top;">Duration</td>
            <td style="padding:4px 0;color:#1A1A1A;vertical-align:top;">{{ $duration }}</td>
          </tr>
          @endif
          @if ($endsAt)
          <tr>
            <td style="padding:4px 0;color:#92400E;vertical-align:top;">&#10003;</td>
            <td style="padding:4px 0;color:#92400E;font-weight:600;vertical-align:top;">Expected back</td>
            <td style="padding:4px 0;color:#1A1A1A;vertical-align:top;">{{ $endsAt->format('g:i A T') }}</td>
          </tr>
          @endif
        </table>
      </div>

      {{-- What this means --}}
      <h2 style="font-size:16px;font-weight:700;color:#1A1A1A;margin:0 0 10px;">
        What this means for you
      </h2>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#374151;">
        <li>The Wayfield web admin will be unavailable during this window</li>
        <li>Participant check-in and session selection will be temporarily offline</li>
        <li>Any work in progress should be saved before
          @if ($startsAt) {{ $startsAt->format('g:i A T') }} @else the window begins @endif</li>
        <li>All your data is safe &mdash; this is a planned infrastructure update</li>
      </ul>

      {{-- What to do --}}
      <h2 style="font-size:16px;font-weight:700;color:#1A1A1A;margin:0 0 10px;">
        What you should do
      </h2>
      <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:1.8;color:#374151;">
        <li>Complete any time-sensitive actions before
          @if ($startsAt) {{ $startsAt->format('g:i A T') }} @else maintenance begins @endif</li>
        <li>Inform your participants if your workshop runs during this window</li>
        <li>The app will resume automatically when maintenance is complete</li>
      </ul>

      @if ($bodyMessage)
        <div style="background:#F3F4F6;border-radius:6px;padding:14px 18px;margin-bottom:24px;font-size:14px;color:#374151;line-height:1.6;">
          <strong>Additional notes:</strong><br>
          {{ $bodyMessage }}
        </div>
      @endif

    </div>
  </div>

  {{-- Footer --}}
  <div style="text-align:center;padding:24px 16px 8px;font-size:12px;color:#9CA3AF;line-height:1.6;">
    <p style="margin:0 0 6px;">
      Questions? Reply to this email or visit our
      <a href="{{ $helpUrl }}" style="color:#6B7280;">help center</a>.
    </p>
    <p style="margin:0;">
      You're receiving this because you're an organizer on Wayfield.
      &nbsp;·&nbsp;
      <a href="https://wayfieldapp.com" style="color:#9CA3AF;">wayfieldapp.com</a>
    </p>
  </div>

</div>
</body>
</html>
