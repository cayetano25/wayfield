<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 13px;
    color: #2E2E2E;
    line-height: 1.5;
}

/* ── Header ─────────────────────────── */
.header {
    padding: 32px 40px 24px;
    border-bottom: 3px solid {{ $branding->primaryColor }};
    overflow: hidden;
}
.header-left  { float: left; }
.header-right { float: right; text-align: right; }

.org-logo {
    max-height: 60px;
    max-width: 200px;
    display: block;
    margin-bottom: 6px;
}
.org-name { font-size: 17px; font-weight: 700; color: #111827; }
.org-details { font-size: 11px; color: #6B7280; margin-top: 2px; }
.wayfield-brand { font-size: 10px; color: #9CA3AF; margin-top: 6px; }

.receipt-title {
    font-size: 22px;
    font-weight: 700;
    color: {{ $branding->primaryColor }};
}
.receipt-number { font-size: 11px; color: #6B7280; margin-top: 4px; font-family: Courier, monospace; }

/* ── Status badge ────────────────────── */
.status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 6px;
}
.status-completed { background: #DCFCE7; color: #166534; }
.status-refunded  { background: #FEF3C7; color: #92400E; }

/* ── Parties ─────────────────────────── */
.parties {
    background: #F9FAFB;
    border-bottom: 1px solid #E5E7EB;
    padding: 20px 40px;
    overflow: hidden;
}
.party-left  { float: left; }
.party-right { float: right; text-align: right; }
.party-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #9CA3AF;
    margin-bottom: 3px;
}
.party-name   { font-size: 14px; font-weight: 600; color: #111827; }
.party-detail { font-size: 11px; color: #6B7280; }

/* ── Payment summary box ─────────────── */
.payment-summary {
    margin: 24px 40px;
    border: 1px solid #E5E7EB;
    border-radius: 6px;
}
.summary-header {
    background: {{ $branding->primaryColor }};
    color: white;
    padding: 9px 16px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}
.summary-grid { padding: 14px 0; overflow: hidden; }
.summary-item {
    float: left;
    width: 25%;
    text-align: center;
    padding: 0 8px;
}
.summary-value { font-size: 17px; font-weight: 700; color: #111827; }
.summary-label { font-size: 9px; color: #6B7280; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.08em; }

/* ── Section title ───────────────────── */
.section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #9CA3AF;
    padding: 0 40px;
    margin-bottom: 6px;
}

/* ── Line items table ────────────────── */
.items-wrapper { padding: 0 40px; }

table { width: 100%; border-collapse: collapse; }

table th {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6B7280;
    padding: 8px 4px;
    border-bottom: 1px solid #E5E7EB;
    text-align: left;
}
table th.right { text-align: right; }
table td {
    padding: 10px 4px;
    border-bottom: 1px solid #F3F4F6;
    vertical-align: top;
}
table td.right { text-align: right; }

.item-name   { font-weight: 600; color: #111827; }
.item-detail { font-size: 11px; color: #6B7280; margin-top: 2px; }
.item-badge  {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    color: {{ $branding->primaryColor }};
    border: 1px solid {{ $branding->primaryColor }};
    border-radius: 3px;
    padding: 1px 4px;
    margin-left: 4px;
}

/* ── Totals ──────────────────────────── */
.totals { padding: 8px 40px 0; }
.totals-row { overflow: hidden; padding: 4px 0; font-size: 12px; color: #6B7280; }
.totals-row.grand { font-size: 14px; font-weight: 700; color: #111827; border-top: 2px solid #E5E7EB; padding-top: 8px; margin-top: 4px; }
.totals-label { float: right; width: 200px; text-align: right; padding-right: 16px; }
.totals-value { float: right; width: 80px; text-align: right; font-weight: 500; }

/* ── Notice boxes ────────────────────── */
.notice {
    margin: 14px 40px;
    padding: 11px 14px;
    border-radius: 4px;
    font-size: 12px;
}
.notice-deposit { background: #F0FDF4; border-left: 3px solid #22C55E; color: #166534; }
.notice-refund  { background: #FEF3C7; border-left: 3px solid #F59E0B; color: #92400E; }
.notice-tax     { background: #F9FAFB; border: 1px solid #E5E7EB; color: #6B7280; font-size: 11px; line-height: 1.6; }

/* ── Footer ──────────────────────────── */
.footer {
    margin-top: 32px;
    padding: 14px 40px;
    border-top: 1px solid #E5E7EB;
    overflow: hidden;
    font-size: 10px;
    color: #9CA3AF;
}
.footer-left  { float: left; }
.footer-right { float: right; }
</style>
</head>
<body>

{{-- HEADER --}}
<div class="header">
    <div class="header-left">
        @if($branding->showOrgLogo && $branding->logoUrl)
            <img src="{{ $branding->logoUrl }}" alt="{{ $branding->orgName }}" class="org-logo">
        @endif
        <div class="org-name">{{ $branding->orgName }}</div>
        @if($branding->orgEmail)
            <div class="org-details">{{ $branding->orgEmail }}</div>
        @endif
        @if($branding->orgPhone)
            <div class="org-details">{{ $branding->orgPhone }}</div>
        @endif
        @if($branding->showWayfieldBrand)
            <div class="wayfield-brand">Powered by Wayfield</div>
        @endif
    </div>
    <div class="header-right">
        <div class="receipt-title">Receipt</div>
        <div class="receipt-number">{{ $order->order_number }}</div>
        <div style="font-size:11px;color:#6B7280;margin-top:8px">
            {{ $order->completed_at?->format('F j, Y') ?? now()->format('F j, Y') }}
        </div>
        <div>
            @if($order->status === 'completed')
                <span class="status-badge status-completed">Paid</span>
            @elseif($order->status === 'fully_refunded')
                <span class="status-badge status-refunded">Refunded</span>
            @else
                <span class="status-badge status-refunded">Partially Refunded</span>
            @endif
        </div>
    </div>
    <div style="clear:both"></div>
</div>

{{-- PARTIES --}}
<div class="parties">
    <div class="party-left">
        <div class="party-label">Billed To</div>
        <div class="party-name">{{ $user->first_name }} {{ $user->last_name }}</div>
        <div class="party-detail">{{ $user->email }}</div>
    </div>
    <div class="party-right">
        <div class="party-label">Organizer</div>
        <div class="party-name">{{ $order->organization->name }}</div>
        @if($order->organization->primary_contact_email)
            <div class="party-detail">{{ $order->organization->primary_contact_email }}</div>
        @endif
    </div>
    <div style="clear:both"></div>
</div>

{{-- PAYMENT SUMMARY BOX --}}
<div class="payment-summary">
    <div class="summary-header">Payment Summary</div>
    <div class="summary-grid">
        <div class="summary-item">
            <div class="summary-value">
                {{ $order->payment_method === 'free' ? 'Free' : '$'.number_format($order->total_cents / 100, 2) }}
            </div>
            <div class="summary-label">Amount Paid</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">
                {{ $order->completed_at?->format('M j, Y') ?? '—' }}
            </div>
            <div class="summary-label">Payment Date</div>
        </div>
        <div class="summary-item">
            <div class="summary-value">
                {{ $order->payment_method === 'stripe' ? 'Card' : ucfirst($order->payment_method) }}
            </div>
            <div class="summary-label">Method</div>
        </div>
        @if($order->is_deposit_order)
        <div class="summary-item">
            <div class="summary-value">
                {{ $order->balance_paid_at ? 'Paid' : ($order->balance_due_date?->format('M j') ?? '—') }}
            </div>
            <div class="summary-label">{{ $order->balance_paid_at ? 'Balance Paid' : 'Balance Due' }}</div>
        </div>
        @endif
        <div style="clear:both"></div>
    </div>
</div>

{{-- DEPOSIT NOTICE --}}
@if($order->is_deposit_order && !$order->balance_paid_at)
<div class="notice notice-deposit">
    <strong>Deposit paid.</strong>
    The remaining balance is due by {{ $order->balance_due_date?->format('F j, Y') }}.
    A separate receipt will be issued when the balance is paid.
</div>
@endif

{{-- LINE ITEMS --}}
<div style="margin-top:16px">
    <div class="section-title">Items</div>
    <div class="items-wrapper">
        <table>
            <thead>
                <tr>
                    <th style="width:55%">Description</th>
                    <th style="width:30%">Dates</th>
                    <th class="right" style="width:15%">Amount</th>
                </tr>
            </thead>
            <tbody>
                @foreach($items as $item)
                <tr>
                    <td>
                        <div class="item-name">
                            {{ $item->workshop?->title ?? 'Workshop Registration' }}
                            @if($item->item_type === 'addon_session')
                                <span class="item-badge">Add-On</span>
                            @endif
                            @if($item->is_deposit)
                                <span class="item-badge">Deposit</span>
                            @endif
                            @if($item->applied_tier_label)
                                <span class="item-badge">{{ $item->applied_tier_label }}</span>
                            @endif
                        </div>
                        @if($item->session?->title)
                            <div class="item-detail">{{ $item->session->title }}</div>
                        @endif
                        <div class="item-detail" style="text-transform:capitalize">
                            {{ str_replace('_', ' ', $item->item_type) }}
                        </div>
                        @if($item->refunded_amount_cents > 0)
                            <div class="item-detail" style="color:#D97706">
                                Refunded: −${{ number_format($item->refunded_amount_cents / 100, 2) }}
                            </div>
                        @endif
                    </td>
                    <td>
                        @if($item->workshop)
                            <div class="item-detail">
                                {{ \Carbon\Carbon::parse($item->workshop->start_date)->format('M j') }}
                                – {{ \Carbon\Carbon::parse($item->workshop->end_date)->format('M j, Y') }}
                            </div>
                        @endif
                    </td>
                    <td class="right">
                        <div style="font-weight:600;color:#111827">
                            {{ $item->line_total_cents === 0 ? 'Free' : '$'.number_format($item->line_total_cents / 100, 2) }}
                        </div>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
</div>

{{-- TOTALS --}}
<div class="totals">
    <div class="totals-row">
        <div class="totals-value">${{ number_format($order->subtotal_cents / 100, 2) }}</div>
        <div class="totals-label">Subtotal</div>
        <div style="clear:both"></div>
    </div>

    @if($order->discount_cents > 0)
    <div class="totals-row">
        <div class="totals-value" style="color:#16A34A">
            −${{ number_format($order->discount_cents / 100, 2) }}
        </div>
        <div class="totals-label">
            Coupon discount{{ $order->coupon ? ' ('.$order->coupon->code.')' : '' }}
        </div>
        <div style="clear:both"></div>
    </div>
    @endif

    <div class="totals-row grand">
        <div class="totals-value">
            {{ $order->payment_method === 'free' ? 'Free' : '$'.number_format($order->total_cents / 100, 2) }}
        </div>
        <div class="totals-label">Total Paid</div>
        <div style="clear:both"></div>
    </div>
</div>

{{-- REFUND SECTION --}}
@if($refunds->count() > 0)
<div class="notice notice-refund" style="margin-top:16px">
    <strong>Refund(s) processed on this order:</strong>
    @foreach($refunds as $refund)
        <div style="margin-top:4px">
            ${{ number_format($refund->approved_amount_cents / 100, 2) }}
            refunded on {{ $refund->processed_at?->format('M j, Y') }}.
            @if($refund->refundTransactions->first()?->stripe_refund_id)
                Stripe ref: {{ $refund->refundTransactions->first()->stripe_refund_id }}
            @endif
        </div>
    @endforeach
</div>
@endif

{{-- TAX NOTICE --}}
<div class="notice notice-tax" style="margin-top:20px">
    <strong>Tax Deduction Notice:</strong>
    This receipt may be used as documentation for professional development
    expense claims. Please consult your tax advisor to confirm deductibility
    based on your specific circumstances. The organizer is the seller of record
    for this transaction. Order reference: {{ $order->order_number }}.
</div>

{{-- FOOTER --}}
<div class="footer">
    <div class="footer-left">
        Generated {{ now()->format('F j, Y \a\t g:i A') }}
        @if($branding->showWayfieldBrand)
            · Powered by Wayfield
        @endif
    </div>
    <div class="footer-right">{{ $order->order_number }}</div>
    <div style="clear:both"></div>
</div>

</body>
</html>
