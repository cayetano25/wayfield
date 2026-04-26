<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Payment dispute received — Wayfield</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#2E2E2E;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">

        {{-- Header --}}
        <tr>
          <td style="border-top:4px solid #E94F37;padding:28px 32px 20px;">
            <span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:700;color:#0FA3B1;">Wayfield</span>
          </td>
        </tr>

        {{-- Body with urgent left border --}}
        <tr>
          <td style="padding:0 32px 32px;">
            <div style="border-left:4px solid #E94F37;padding-left:16px;margin:0 0 24px;">
              <h1 style="font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:700;color:#B91C1C;margin:0 0 6px;">
                &#9888; Payment dispute received — action required
              </h1>
              <p style="font-size:15px;line-height:1.6;margin:0;color:#2E2E2E;">
                You must submit evidence to Stripe by
                <strong style="color:#B91C1C;">{{ \Carbon\Carbon::parse($evidenceDueBy)->format('F j, Y') }}</strong>.
              </p>
            </div>

            {{-- Dispute details --}}
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin:0 0 20px;">
              <tr style="background:#F9FAFB;">
                <td colspan="2" style="padding:10px 14px;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">
                  Dispute details
                </td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Order number</td>
                <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#111827;">#{{ $order->order_number }}</td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Disputed amount</td>
                <td style="padding:10px 14px;font-size:14px;font-weight:700;color:#E94F37;">
                  ${{ number_format($dispute->amount_cents / 100, 2) }}
                </td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Reason</td>
                <td style="padding:10px 14px;font-size:14px;color:#111827;">{{ ucwords(str_replace('_', ' ', $dispute->reason)) }}</td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Evidence deadline</td>
                <td style="padding:10px 14px;font-size:14px;font-weight:700;color:#B91C1C;">
                  {{ \Carbon\Carbon::parse($evidenceDueBy)->format('F j, Y') }}
                </td>
              </tr>
            </table>

            {{-- What to include --}}
            <h3 style="font-family:'Sora',Arial,sans-serif;font-size:15px;font-weight:700;color:#111827;margin:0 0 8px;">
              What to include in your evidence
            </h3>
            <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.9;color:#2E2E2E;">
              <li>Registration confirmation and payment receipt</li>
              <li>Workshop schedule and session attendance records</li>
              <li>Any communications sent to participants about the event</li>
              <li>Your refund and cancellation policy</li>
              <li>Any other documentation showing services were delivered</li>
            </ul>

            <p style="font-size:14px;line-height:1.6;color:#6B7280;margin:0 0 20px;">
              Log into your Stripe dashboard to submit evidence before the deadline.
              Missing the deadline may result in an automatic loss.
            </p>

            {{-- CTA --}}
            <div style="text-align:center;margin:20px 0 8px;">
              <a href="{{ $stripeDashboardUrl }}"
                style="display:inline-block;background:#E94F37;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
                Respond in Stripe Dashboard
              </a>
            </div>
          </td>
        </tr>

        {{-- Footer --}}
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #E5E7EB;">
            <p style="font-size:12px;color:#9CA3AF;margin:0;">&copy; {{ date('Y') }} Wayfield</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
