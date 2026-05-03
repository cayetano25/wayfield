<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>Support Reply — Wayfield</title>
</head>
<body style="margin:0;padding:0;word-break:break-word;-webkit-font-smoothing:antialiased;background-color:#F5F5F5;">

{{-- Preheader --}}
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
{{ $preheader }}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
</div>

<div style="font-family:'Plus Jakarta Sans','Helvetica Neue',Helvetica,Arial,sans-serif;color:#2E2E2E;max-width:600px;margin:0 auto;padding:24px 16px;">

  {{-- Header --}}
  <div style="text-align:center;padding:24px 0 16px;">
    <div style="display:inline-block;">
      <span style="font-size:22px;font-weight:700;color:#0FA3B1;letter-spacing:-0.5px;">Wayfield</span>
      <span style="font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.1em;margin-left:8px;vertical-align:middle;">Support</span>
    </div>
  </div>

  {{-- Card --}}
  <div style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

    {{-- Teal top stripe --}}
    <div style="background:#0FA3B1;height:4px;"></div>

    {{-- Body --}}
    <div style="padding:32px;">

      {{-- Ticket context --}}
      <div style="background:#F9FAFB;border-radius:6px;padding:10px 14px;margin-bottom:24px;font-size:13px;color:#6B7280;">
        <span style="font-weight:600;color:#374151;">{{ $ticket->subject }}</span>
        &nbsp;&mdash;&nbsp;Ticket #{{ $ticket->id }}
        &nbsp;&middot;&nbsp;Submitted {{ $submittedAt->diffForHumans() }}
      </div>

      <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1A1A1A;line-height:1.3;">
        We've responded to your request
      </h1>

      @if ($firstName)
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi {{ $firstName }},</p>
      @else
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi there,</p>
      @endif

      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#374151;">
        Our support team has replied to your request:
      </p>

      {{-- Reply box --}}
      <div style="border-left:4px solid #0FA3B1;padding:16px 20px;background:#F8FFFE;border-radius:0 6px 6px 0;margin-bottom:28px;font-size:15px;line-height:1.7;color:#1A1A1A;">
        {!! nl2br(e($replyMessage->body)) !!}
        <p style="margin:16px 0 0;font-size:13px;color:#6B7280;">— Wayfield Support</p>
      </div>

      {{-- CTA --}}
      <div style="text-align:center;margin:0 0 28px;">
        <a href="{{ $ticketUrl }}"
           style="display:inline-block;background:#0FA3B1;color:#ffffff;padding:13px 28px;border-radius:7px;text-decoration:none;font-size:15px;font-weight:600;">
          View Ticket in Wayfield
        </a>
      </div>

      {{-- Separator --}}
      <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 24px;">

      {{-- Original message (collapsed-style) --}}
      <div style="font-size:13px;color:#9CA3AF;">
        <p style="margin:0 0 10px;font-weight:600;color:#6B7280;">Your original message:</p>
        <div style="background:#F9FAFB;border-radius:6px;padding:14px 16px;font-style:italic;line-height:1.6;color:#6B7280;white-space:pre-wrap;">{{ $originalBody }}</div>
      </div>

    </div>
  </div>

  {{-- Footer --}}
  <div style="text-align:center;padding:24px 16px 8px;font-size:12px;color:#9CA3AF;line-height:1.6;">
    <p style="margin:0 0 4px;">
      Ticket #{{ $ticket->id }} &nbsp;·&nbsp; Submitted {{ $submittedAt->diffForHumans() }}
    </p>
    <p style="margin:0 0 4px;">
      Reply to this email or visit your
      <a href="{{ $ticketUrl }}" style="color:#6B7280;">Wayfield dashboard</a> for follow-up.
    </p>
    <p style="margin:0;color:#B0B8C4;">
      {{ $supportEmail }}
      &nbsp;·&nbsp;
      <a href="https://wayfieldapp.com" style="color:#9CA3AF;">wayfieldapp.com</a>
    </p>
  </div>

</div>
</body>
</html>
