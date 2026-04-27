<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>You're registered! — Wayfield</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#2E2E2E;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">

        {{-- Header --}}
        <tr>
          <td style="border-top:4px solid #0FA3B1;padding:28px 32px 20px;">
            <span style="font-family:'Sora',Arial,sans-serif;font-size:20px;font-weight:700;color:#0FA3B1;text-decoration:none;">Wayfield</span>
          </td>
        </tr>

        {{-- Body --}}
        <tr>
          <td style="padding:0 32px 32px;">
            <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hi {{ $order->user->first_name }},</p>

            <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
              Your payment was received and your registration is confirmed for
              <strong>{{ $workshopTitle }}</strong>.
            </p>

            {{-- Order summary --}}
            <table width="100%" cellpadding="0" cellspacing="0"
              style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin:20px 0;">
              <tr style="background:#F9FAFB;">
                <th align="left" style="padding:10px 14px;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Item</th>
                <th align="right" style="padding:10px 14px;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
              </tr>
              @foreach($order->items as $item)
              <tr style="border-top:1px solid #E5E7EB;">
                <td style="padding:12px 14px;font-size:14px;color:#111827;">
                  {{ $item->workshop_title ?? $item->session_title ?? 'Registration' }}
                  @if($item->quantity > 1)
                    <span style="color:#6B7280;font-size:13px;"> × {{ $item->quantity }}</span>
                  @endif
                </td>
                <td align="right" style="padding:12px 14px;font-size:14px;font-weight:600;color:#111827;">
                  ${{ number_format($item->line_total_cents / 100, 2) }}
                </td>
              </tr>
              @endforeach
              <tr style="border-top:2px solid #E5E7EB;background:#F9FAFB;">
                <td style="padding:12px 14px;font-size:15px;font-weight:700;color:#111827;">Total</td>
                <td align="right" style="padding:12px 14px;font-size:15px;font-weight:700;color:#0FA3B1;">
                  ${{ number_format($order->total_cents / 100, 2) }}
                </td>
              </tr>
            </table>

            <p style="font-size:12px;color:#9CA3AF;margin:0 0 16px;">
              Order #{{ $order->order_number }}
            </p>

            {{-- Deposit note --}}
            @if($order->is_deposit_order && $order->balance_amount_cents)
            <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:14px 16px;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#92400E;line-height:1.6;">
                <strong>Deposit of ${{ number_format($order->subtotal_cents / 100, 2) }} received.</strong>
                Balance of ${{ number_format($order->balance_amount_cents / 100, 2) }} is due
                @if($order->balance_due_date)
                  by {{ \Carbon\Carbon::parse($order->balance_due_date)->format('F j, Y') }}.
                @else
                  before the workshop.
                @endif
              </p>
            </div>
            @endif

            {{-- Commitment date callout --}}
            @if(isset($pricing) && $pricing->commitment_date && $pricing->commitment_description)
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px 16px;margin:16px 0;">
              <p style="margin:0;font-size:14px;color:#92400E;line-height:1.6;">
                {{ $pricing->commitment_description }}
              </p>
            </div>
            @endif

            {{-- What's next --}}
            <h3 style="font-family:'Sora',Arial,sans-serif;font-size:16px;font-weight:700;color:#111827;margin:24px 0 10px;">What&rsquo;s next</h3>
            <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;color:#2E2E2E;">
              @if(isset($startDate))
              <li>Workshop begins <strong>{{ $startDate }}</strong></li>
              @endif
              @if(isset($locationName))
              <li>Location: {{ $locationName }}</li>
              @endif
              @if(isset($isVirtual) && $isVirtual)
              <li>A meeting link will be shared before the session begins</li>
              @endif
            </ul>

            {{-- Refund policy --}}
            @if(isset($refundPolicy) && $refundPolicy->custom_policy_text)
            <p style="font-size:13px;color:#6B7280;line-height:1.6;margin:16px 0;">
              <strong>Refund policy:</strong> {{ $refundPolicy->custom_policy_text }}
            </p>
            @endif

            {{-- CTA --}}
            <div style="text-align:center;margin:28px 0 8px;">
              <a href="{{ $viewRegistrationUrl }}"
                style="display:inline-block;background:#0FA3B1;color:#ffffff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;font-family:'Plus Jakarta Sans',Arial,sans-serif;">
                View My Registration
              </a>
            </div>
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
