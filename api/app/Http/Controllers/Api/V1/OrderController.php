<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\BalancePaymentService;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * GET /api/v1/orders
     * Participant's own order history.
     */
    public function index(Request $request): JsonResponse
    {
        $orders = Order::query()
            ->where('user_id', $request->user()->id)
            ->with('items.workshop', 'items.session')
            ->latest()
            ->paginate(20);

        return response()->json([
            'data'  => OrderResource::collection($orders->items()),
            'meta'  => [
                'current_page' => $orders->currentPage(),
                'last_page'    => $orders->lastPage(),
                'per_page'     => $orders->perPage(),
                'total'        => $orders->total(),
            ],
        ]);
    }

    /**
     * GET /api/v1/orders/{order}
     * Participant's own order detail. Enforces ownership.
     */
    public function show(Request $request, Order $order): JsonResponse
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        $order->load('items.workshop', 'items.session', 'refundRequests');

        return response()->json(new OrderResource($order));
    }

    /**
     * GET /api/v1/organizations/{organization}/orders
     * Organizer view of all orders for the organization.
     * Auth: role IN ('owner', 'admin', 'staff')
     */
    public function orgIndex(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOrgAccess($request, $organization);

        $query = Order::query()
            ->where('organization_id', $organization->id)
            ->with('items.workshop', 'items.session', 'user');

        // Filters
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->boolean('is_deposit_only')) {
            $query->where('is_deposit_order', true)
                ->whereNull('balance_paid_at');
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            })->orWhere('order_number', 'like', "%{$search}%");
        }

        $orders = $query->latest()->paginate(20);

        return response()->json([
            'data'  => OrderResource::collection($orders->items()),
            'meta'  => [
                'current_page' => $orders->currentPage(),
                'last_page'    => $orders->lastPage(),
                'per_page'     => $orders->perPage(),
                'total'        => $orders->total(),
            ],
        ]);
    }

    /**
     * GET /api/v1/orders/{order}/balance-payment-intent
     *
     * Creates (or retrieves) a Stripe PaymentIntent for the outstanding balance.
     * Used by the /balance-payment/{order_number} page when balance_auto_charge = false
     * or when the participant wants to pay early.
     *
     * Auth: order owner only.
     * Returns 422 if balance is already paid or order is cancelled.
     */
    public function balancePaymentIntent(Request $request, Order $order, BalancePaymentService $service): JsonResponse
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        if (! $order->is_deposit_order) {
            return response()->json(['error' => 'no_balance', 'message' => 'This order does not have a balance payment.'], 422);
        }

        if ($order->balance_paid_at !== null) {
            return response()->json(['error' => 'already_paid', 'message' => 'Balance has already been paid.'], 422);
        }

        if (in_array($order->status, ['cancelled', 'fully_refunded'], true)) {
            return response()->json(['error' => 'grace_period_expired', 'message' => 'The grace period for this balance payment has expired.'], 422);
        }

        // 3-day grace window after the due date.
        $graceCutoff = \Carbon\Carbon::parse($order->balance_due_date)->addDays(3)->endOfDay();
        if (now()->isAfter($graceCutoff)) {
            return response()->json(['error' => 'grace_period_expired', 'message' => 'The grace period for this balance payment has expired.'], 422);
        }

        $intentData = $service->prepareBalanceIntent($order);

        $order->loadMissing('items.workshop');
        $workshopTitle = $order->items
            ->where('item_type', 'workshop_registration')
            ->first()
            ?->workshop
            ?->title;

        return response()->json([
            'client_secret'          => $intentData['client_secret'],
            'stripe_publishable_key' => $intentData['stripe_publishable_key'],
            'amount_cents'           => $intentData['amount_cents'],
            'deposit_amount_cents'   => (int) $order->total_cents,
            'balance_due_date'       => $order->balance_due_date?->toDateString(),
            'workshop_title'         => $workshopTitle,
            'order_number'           => $order->order_number,
            'days_until_expiry'      => max(0, (int) now()->diffInDays($graceCutoff, false)),
        ]);
    }

    private function authorizeOrgAccess(Request $request, Organization $organization): void
    {
        $user = $request->user();
        $role = $organization->memberRole($user);

        if (! in_array($role, ['owner', 'admin', 'staff'], true)) {
            abort(403, 'Access denied.');
        }
    }
}
