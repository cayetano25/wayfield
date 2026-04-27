<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Refund request received — Wayfield</title>
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
            <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi {{ $recipient->first_name }},</p>

            <h1 style="font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:700;color:#111827;margin:0 0 12px;">
              Refund request received — action required
            </h1>

            <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
              A participant has submitted a refund request for
              <strong>{{ $workshopTitle }}</strong> and is waiting for your response.
            </p>

            {{-- Request details --}}
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin:0 0 20px;">
              <tr style="background:#F9FAFB;">
                <td colspan="2" style="padding:10px 14px;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">
                  Request details
                </td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Participant</td>
                <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#111827;">
                  {{ $refundRequest->requestedBy->first_name }} {{ $refundRequest->requestedBy->last_name }}
                </td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Order number</td>
                <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#111827;">
                  #{{ $order->order_number }}
                </td>
              </tr>
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Requested amount</td>
                <td style="padding:10px 14px;font-size:14px;font-weight:600;color:#E94F37;">
                  ${{ number_format($refundRequest->requested_amount_cents / 100, 2) }}
                </td>
              </tr>
              @if($refundRequest->reason_text)
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:10px 14px;font-size:14px;color:#6B7280;">Reason</td>
                <td style="padding:10px 14px;font-size:14px;color:#111827;">{{ $refundRequest->reason_text }}</td>
              </tr>
              @endif
            </table>

            {{-- Refund policy --}}
            @if(isset($refundPolicy) && $refundPolicy->custom_policy_text)
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Your refund policy</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#2E2E2E;">{{ $refundPolicy->custom_policy_text }}</p>
            </div>
            @endif

            {{-- CTA --}}
            <div style="text-align:center;margin:20px 0 8px;">
              <a href="{{ $reviewUrl }}"
                style="display:inline-block;background:#0FA3B1;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
                Review Request
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
