<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Exceptions\CommitmentDateRefundException;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\RefundRequest;
use App\Domain\Payments\Services\RefundService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ApproveRefundRequest;
use App\Http\Requests\Api\V1\CreateRefundRequestRequest;
use App\Http\Requests\Api\V1\DenyRefundRequest;
use App\Http\Requests\Api\V1\IssueCreditRequest;
use App\Http\Resources\RefundRequestResource;
use App\Http\Resources\RefundTransactionResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RefundRequestController extends Controller
{
    public function __construct(
        private readonly RefundService $refundService,
    ) {}

    /**
     * POST /api/v1/orders/{order}/refund-requests
     * Participant submits a refund request for their own order.
     */
    public function store(CreateRefundRequestRequest $request, Order $order): JsonResponse
    {
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        try {
            $refundRequest = $this->refundService->requestRefund(
                order: $order,
                requestedBy: $request->user(),
                reasonCode: $request->input('reason_code'),
                reasonText: $request->input('reason_text'),
                requestedAmountCents: (int) $request->input('requested_amount_cents'),
                orderItemId: $request->input('order_item_id') ? (int) $request->input('order_item_id') : null,
            );
        } catch (CommitmentDateRefundException $e) {
            return response()->json([
                'error'   => 'commitment_date_passed',
                'message' => $e->getMessage(),
            ], 422);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'error'   => 'validation_failed',
                'message' => $e->getMessage(),
            ], 422);
        }

        $refundRequest->load('refundTransactions');

        return response()->json(new RefundRequestResource($refundRequest), 201);
    }

    /**
     * GET /api/v1/orders/{order}/refund-requests
     * Participant (own order) or organizer views refund history for an order.
     */
    public function indexForOrder(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();

        $isOwner = $order->user_id === $user->id;
        $isOrganizer = in_array(
            $order->organization?->memberRole($user),
            ['owner', 'admin', 'staff'],
            true,
        );

        if (! $isOwner && ! $isOrganizer) {
            return response()->json(['error' => 'Not found.'], 404);
        }

        $refundRequests = $order->refundRequests()
            ->with('refundTransactions', 'requestedBy', 'reviewedBy')
            ->latest()
            ->get();

        return response()->json(RefundRequestResource::collection($refundRequests));
    }

    /**
     * GET /api/v1/organizations/{organization}/refund-requests
     * Organizer views all refund requests for the organization with filters.
     * Auth: role IN ('owner', 'admin', 'staff')
     */
    public function indexForOrganization(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOrgAccess($request, $organization);

        $query = RefundRequest::query()
            ->whereHas('order', fn ($q) => $q->where('organization_id', $organization->id))
            ->with('order.user', 'requestedBy', 'reviewedBy', 'refundTransactions');

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $refundRequests = $query->latest()->paginate(20);

        return response()->json([
            'data' => RefundRequestResource::collection($refundRequests->items()),
            'meta' => [
                'current_page' => $refundRequests->currentPage(),
                'last_page'    => $refundRequests->lastPage(),
                'per_page'     => $refundRequests->perPage(),
                'total'        => $refundRequests->total(),
            ],
        ]);
    }

    /**
     * POST /api/v1/refund-requests/{refundRequest}/approve
     * Organizer approves a pending refund request.
     * Auth: role IN ('owner', 'admin')
     */
    public function approve(ApproveRefundRequest $request, RefundRequest $refundRequest): JsonResponse
    {
        $organization = $refundRequest->order?->organization;

        if (! $organization) {
            return response()->json(['error' => 'Order organization not found.'], 404);
        }

        $this->authorizeOrgManagementAccess($request, $organization);

        if (! $refundRequest->isPending()) {
            return response()->json([
                'error'   => 'not_pending',
                'message' => 'Only pending refund requests can be approved.',
            ], 422);
        }

        try {
            $refundTransaction = $this->refundService->approveRefund(
                refundRequest: $refundRequest,
                isAutomatic: false,
                reviewedBy: $request->user(),
                approvedAmountCents: $request->input('approved_amount_cents')
                    ? (int) $request->input('approved_amount_cents')
                    : null,
                reviewNotes: $request->input('review_notes'),
            );
        } catch (\Stripe\Exception\ApiErrorException $e) {
            return response()->json([
                'error'   => 'stripe_error',
                'message' => $e->getMessage(),
            ], 502);
        }

        return response()->json(new RefundTransactionResource($refundTransaction));
    }

    /**
     * POST /api/v1/refund-requests/{refundRequest}/deny
     * Organizer denies a pending refund request.
     * Auth: role IN ('owner', 'admin')
     */
    public function deny(DenyRefundRequest $request, RefundRequest $refundRequest): JsonResponse
    {
        $organization = $refundRequest->order?->organization;

        if (! $organization) {
            return response()->json(['error' => 'Order organization not found.'], 404);
        }

        $this->authorizeOrgManagementAccess($request, $organization);

        if (! $refundRequest->isPending()) {
            return response()->json([
                'error'   => 'not_pending',
                'message' => 'Only pending refund requests can be denied.',
            ], 422);
        }

        $this->refundService->denyRefund(
            refundRequest: $refundRequest,
            reviewedBy: $request->user(),
            reviewNotes: $request->input('review_notes'),
        );

        return response()->json(['status' => 'denied']);
    }

    /**
     * POST /api/v1/refund-requests/{refundRequest}/issue-credit
     * Organizer issues a platform credit instead of a monetary refund.
     * Auth: role IN ('owner', 'admin')
     */
    public function issueCredit(IssueCreditRequest $request, RefundRequest $refundRequest): JsonResponse
    {
        $organization = $refundRequest->order?->organization;

        if (! $organization) {
            return response()->json(['error' => 'Order organization not found.'], 404);
        }

        $this->authorizeOrgManagementAccess($request, $organization);

        $credit = $this->refundService->issueCredit(
            refundRequest: $refundRequest,
            amountCents: (int) $request->input('amount_cents'),
            expiryDays: (int) $request->input('expiry_days', 365),
        );

        return response()->json([
            'id'           => $credit->id,
            'amount_cents' => $credit->amount_cents,
            'currency'     => $credit->currency,
            'expires_at'   => $credit->expires_at->toIso8601String(),
            'user_id'      => $credit->user_id,
        ], 201);
    }

    // ─── Auth helpers ─────────────────────────────────────────────────────────

    private function authorizeOrgAccess(Request $request, Organization $organization): void
    {
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin', 'staff'], true)) {
            abort(403, 'Access denied.');
        }
    }

    private function authorizeOrgManagementAccess(Request $request, Organization $organization): void
    {
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Access denied. Requires owner or admin role.');
        }
    }
}
