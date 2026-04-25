<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\Order;
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

    private function authorizeOrgAccess(Request $request, Organization $organization): void
    {
        $user = $request->user();
        $role = $organization->memberRole($user);

        if (! in_array($role, ['owner', 'admin', 'staff'], true)) {
            abort(403, 'Access denied.');
        }
    }
}
