<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="x-apple-disable-message-reformatting">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<title>{{ $announcement->title }} — Wayfield</title>
</head>
<body style="margin:0;padding:0;word-break:break-word;-webkit-font-smoothing:antialiased;background-color:#F5F5F5;">

{{-- Preheader: hidden text shown in email client preview pane --}}
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

    @php
      $bannerColors = [
        'info'        => ['bg' => '#3B82F6', 'label' => 'Info'],
        'warning'     => ['bg' => '#E67E22', 'label' => 'Warning'],
        'maintenance' => ['bg' => '#E67E22', 'label' => 'Maintenance'],
        'outage'      => ['bg' => '#E94F37', 'label' => 'Outage'],
        'update'      => ['bg' => '#0FA3B1', 'label' => 'Update'],
        'critical'    => ['bg' => '#E94F37', 'label' => 'Critical'],
      ];
      $band = $bannerColors[$announcement->announcement_type] ?? ['bg' => '#0FA3B1', 'label' => 'Notice'];
    @endphp

    {{-- Type banner --}}
    <div style="background:{{ $band['bg'] }};padding:10px 32px;">
      <span style="color:#ffffff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">
        {{ $band['label'] }}
      </span>
    </div>

    {{-- Body --}}
    <div style="padding:32px;">
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;">
        {{ $announcement->title }}
      </h1>

      @if ($firstName)
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi {{ $firstName }},</p>
      @else
        <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Hi there,</p>
      @endif

      <div style="font-size:15px;line-height:1.7;color:#2E2E2E;margin-bottom:24px;">
        {!! nl2br(e($announcement->message)) !!}
      </div>

      @if ($announcement->ends_at)
        <div style="background:#F9FAFB;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#6B7280;">
          This notice is active until
          <strong style="color:#374151;">{{ $announcement->ends_at->format('F j, Y \a\t g:i A T') }}</strong>.
        </div>
      @endif

      <div style="text-align:center;margin:28px 0 8px;">
        <a href="{{ $dashboardUrl }}"
           style="display:inline-block;background:#0FA3B1;color:#ffffff;padding:13px 28px;border-radius:7px;text-decoration:none;font-size:15px;font-weight:600;">
          Go to Dashboard
        </a>
      </div>
    </div>

  </div>

  {{-- Footer --}}
  <div style="text-align:center;padding:28px 16px 8px;font-size:12px;color:#9CA3AF;line-height:1.6;">
    <p style="margin:0 0 6px;">
      You're receiving this because you're an organizer on Wayfield.
    </p>
    <p style="margin:0;">
      <a href="{{ $settingsUrl }}" style="color:#9CA3AF;">Manage notification preferences</a>
      &nbsp;·&nbsp;
      <a href="https://wayfieldapp.com" style="color:#9CA3AF;">wayfieldapp.com</a>
    </p>
  </div>

</div>
</body>
</html>
