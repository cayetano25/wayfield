<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\FeeCalculationService;
use App\Http\Controllers\Controller;
use App\Jobs\SendReceiptEmailJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class OrderHistoryController extends Controller
{
    public function __construct(private readonly FeeCalculationService $fees) {}

    /**
     * GET /api/v1/me/orders
     * Authenticated user's own order list with optional filtering.
     */
    public function orders(Request $request): JsonResponse
    {
        $user    = $request->user();
        $perPage = min((int) $request->input('per_page', 20), 50);

        $orders = Order::where('user_id', $user->id)
            ->when($request->input('status'), function ($q, $status) {
                return match ($status) {
                    'refunded' => $q->whereIn('status', ['partially_refunded', 'fully_refunded']),
                    default    => $q->where('status', $status),
                };
            })
            ->when($request->input('year'), fn ($q, $year) =>
                $q->whereYear('completed_at', $year)
            )
            ->with([
                'organization:id,name,logo_url',
                'items.workshop:id,title,start_date,end_date,timezone',
                'items.session:id,title,start_at',
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        $totalSpentCents = Order::where('user_id', $user->id)
            ->where('status', 'completed')
            ->sum('total_cents');

        return response()->json([
            'data' => $orders->map(fn ($order) => $this->formatOrderSummary($order)),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page'    => $orders->lastPage(),
                'total'        => $orders->total(),
                'total_spent'  => $this->fees->formatCents((int) $totalSpentCents),
            ],
        ]);
    }

    /**
     * GET /api/v1/me/orders/{orderNumber}
     * Full detail for one of the authenticated user's orders.
     * Strict ownership: returns 404 for any order the user doesn't own.
     */
    public function show(Request $request, string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)
            ->where('user_id', $request->user()->id)
            ->with([
                'organization',
                'items.workshop',
                'items.session',
                'items.registration',
                'refundRequests.refundTransactions',
                'coupon:id,code,label,discount_type,discount_pct,discount_amount_cents',
            ])
            ->firstOrFail();

        return response()->json([
            'data' => array_merge(
                $this->formatOrderSummary($order),
                [
                    'subtotal_cents'      => $order->subtotal_cents,
                    'balance_amount_cents' => $order->balance_amount_cents,
                    'wayfield_fee_cents' => $order->wayfield_fee_cents,
                    'stripe_fee_cents'   => $order->stripe_fee_cents,
                    'discount_cents'     => $order->discount_cents,
                    'coupon'             => $order->coupon ? [
                        'code'             => $order->coupon->code,
                        'discount_type'    => $order->coupon->discount_type,
                        'discount_display' => $order->coupon->getFormattedDiscount(),
                    ] : null,
                    'refund_requests' => $order->refundRequests->map(fn ($r) => [
                        'id'               => $r->id,
                        'status'           => $r->status,
                        'requested_amount' => $this->fees->formatCents($r->requested_amount_cents),
                        'approved_amount'  => $r->approved_amount_cents
                            ? $this->fees->formatCents($r->approved_amount_cents)
                            : null,
                        'created_at'  => $r->created_at->toIso8601String(),
                        'processed_at' => $r->processed_at?->toIso8601String(),
                    ])->toArray(),
                    'can_request_refund' => $this->canRequestRefund($order),
                    'receipt_url'        => route('api.me.orders.receipt', $orderNumber),
                ]
            ),
        ]);
    }

    /**
     * POST /api/v1/me/orders/{orderNumber}/resend-receipt
     * Rate-limited: one resend per order per hour.
     */
    public function resendReceipt(Request $request, string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)
            ->where('user_id', $request->user()->id)
            ->where('status', 'completed')
            ->firstOrFail();

        $cacheKey = "receipt_resend_{$order->id}_{$request->user()->id}";

        if (Cache::has($cacheKey)) {
            return response()->json([
                'message' => 'Receipt was recently sent. Please wait before requesting again.',
            ], 429);
        }

        dispatch(new SendReceiptEmailJob($order->id, $request->user()->id));
        Cache::put($cacheKey, true, now()->addHour());

        return response()->json(['message' => 'Receipt sent to your email address.']);
    }

    // ─── Private helpers ────────────────────────────────────────────────────────

    private function formatOrderSummary(Order $order): array
    {
        return [
            'id'               => $order->id,
            'order_number'     => $order->order_number,
            'status'           => $order->status,
            'status_label'     => $order->getPaymentStatusLabel(),
            'total'            => $this->fees->formatCents($order->total_cents ?? 0),
            'total_cents'      => $order->total_cents,
            'currency'         => $order->currency,
            'payment_method'   => $order->payment_method,
            'is_deposit_order' => $order->is_deposit_order,
            'deposit_paid_at'  => $order->deposit_paid_at?->toIso8601String(),
            'balance_paid_at'  => $order->balance_paid_at?->toIso8601String(),
            'balance_due_date' => $order->balance_due_date?->toDateString(),
            'completed_at'     => $order->completed_at?->toIso8601String(),
            'organization'     => $order->organization ? [
                'id'      => $order->organization->id,
                'name'    => $order->organization->name,
                'logo_url' => $order->organization->logo_url,
            ] : null,
            'items' => $order->items->map(fn ($item) => [
                'id'              => $item->id,
                'item_type'       => $item->item_type,
                'item_type_label' => match ($item->item_type) {
                    'workshop_registration' => 'Workshop Registration',
                    'addon_session'         => 'Add-On Session',
                    'waitlist_upgrade'      => 'Waitlist Upgrade',
                    default                 => $item->item_type,
                },
                'workshop_id'        => $item->workshop_id,
                'workshop_title'     => $item->workshop?->title,
                'workshop_dates'     => $item->workshop
                    ? $item->workshop->start_date . ' – ' . $item->workshop->end_date
                    : null,
                'session_title'      => $item->session?->title,
                'line_total'         => $this->fees->formatCents($item->line_total_cents ?? 0),
                'is_deposit'         => $item->is_deposit,
                'applied_tier_label' => $item->applied_tier_label,
                'refund_status'      => $item->refund_status,
                'refunded_amount'    => $item->refunded_amount_cents > 0
                    ? $this->fees->formatCents($item->refunded_amount_cents)
                    : null,
            ])->toArray(),
        ];
    }

    private function canRequestRefund(Order $order): bool
    {
        if (! in_array($order->status, ['completed', 'partially_refunded'], true)) {
            return false;
        }

        return ! $order->refundRequests()->where('status', 'pending')->exists();
    }
}
