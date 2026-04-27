<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>You're off the waitlist! — Wayfield</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#2E2E2E;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">

        {{-- Header --}}
        <tr>
          <td style="border-top:4px solid #0FA3B1;padding:28px 32px 20px;">
            <span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:700;color:#0FA3B1;">Wayfield</span>
          </td>
        </tr>

        {{-- Body --}}
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi {{ $firstName }},</p>

            <h1 style="font-family:'Sora',Arial,sans-serif;font-size:24px;font-weight:700;color:#111827;margin:0 0 10px;">
              You&rsquo;re off the waitlist!
            </h1>

            <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#2E2E2E;">
              A spot has opened up in <strong>{{ $workshopTitle }}</strong>.
              You have <strong>48 hours</strong> to complete your payment and secure your place.
            </p>

            {{-- Urgency window --}}
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#F0FBFC;border:2px solid #0FA3B1;border-radius:10px;margin:0 0 24px;">
              <tr>
                <td style="padding:18px 20px;text-align:center;">
                  <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#0FA3B1;text-transform:uppercase;letter-spacing:0.05em;">
                    Your spot is reserved until
                  </p>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#0FA3B1;">
                    {{ \Carbon\Carbon::parse($windowExpiresAt)->format('F j, Y \a\t g:i A T') }}
                  </p>
                </td>
              </tr>
            </table>

            {{-- Amount --}}
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #E5E7EB;border-radius:8px;margin:0 0 24px;">
              <tr>
                <td style="padding:14px 16px;font-size:15px;font-weight:600;color:#111827;">Registration fee</td>
                <td align="right" style="padding:14px 16px;font-size:18px;font-weight:700;color:#0FA3B1;">
                  ${{ number_format($amountCents / 100, 2) }}
                </td>
              </tr>
            </table>

            {{-- Primary CTA --}}
            <div style="text-align:center;margin:20px 0 12px;">
              <a href="{{ $paymentUrl }}"
                style="display:inline-block;background:#0FA3B1;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:16px;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
                Secure My Spot Now &rarr;
              </a>
            </div>

            <p style="font-size:13px;color:#6B7280;text-align:center;margin:0 0 24px;line-height:1.6;">
              This link expires in 48 hours. After that, the spot will be given to the next person on the waitlist.
            </p>
          </td>
        </tr>

        {{-- Footer --}}
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #E5E7EB;">
            <p style="font-size:12px;color:#9CA3AF;margin:0;">
              &copy; {{ date('Y') }} Wayfield
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
