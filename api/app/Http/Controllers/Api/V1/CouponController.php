<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\Coupon;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CouponRedemption;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\BulkCouponGenerationService;
use App\Domain\Payments\Services\CouponService;
use App\Domain\Payments\Services\FeeCalculationService;
use App\Domain\Payments\Services\PaymentFeatureFlagService;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BulkGenerateCouponsRequest;
use App\Http\Requests\Api\V1\StoreCouponRequest;
use App\Http\Requests\Api\V1\UpdateCouponRequest;
use App\Http\Resources\CouponResource;
use App\Http\Resources\CouponRedemptionResource;
use App\Models\Organization;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CouponController extends Controller
{
    public function __construct(
        private readonly CouponService $couponService,
        private readonly PaymentFeatureFlagService $flags,
        private readonly FeeCalculationService $fees,
        private readonly BulkCouponGenerationService $bulkGenerationService,
    ) {}

    /**
     * GET /api/v1/organizations/{organization}/coupons
     * Allowed: owner, admin
     */
    public function index(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);

        $query = Coupon::where('organization_id', $organization->id)
            ->with('workshop')
            ->latest();

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('discount_type')) {
            $query->where('discount_type', $request->input('discount_type'));
        }

        if ($request->filled('workshop_id')) {
            $query->where('workshop_id', (int) $request->input('workshop_id'));
        }

        if ($request->filled('search')) {
            $term = '%' . $request->input('search') . '%';
            $query->where(function ($q) use ($term) {
                $q->where('code', 'like', $term)
                    ->orWhere('label', 'like', $term);
            });
        }

        $coupons = $query->paginate(25);

        return response()->json([
            'data'  => CouponResource::collection($coupons->items()),
            'meta'  => [
                'current_page' => $coupons->currentPage(),
                'last_page'    => $coupons->lastPage(),
                'total'        => $coupons->total(),
                'per_page'     => $coupons->perPage(),
            ],
        ]);
    }

    /**
     * GET /api/v1/organizations/{organization}/coupons/{coupon}
     * Allowed: owner, admin
     */
    public function show(Request $request, Organization $organization, Coupon $coupon): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);
        $this->assertCouponBelongsToOrg($coupon, $organization);

        $coupon->load([
            'workshop',
            'redemptions' => fn ($q) => $q->with(['user', 'order', 'workshop'])->latest()->limit(10),
        ]);

        return response()->json(new CouponResource($coupon));
    }

    /**
     * POST /api/v1/organizations/{organization}/coupons
     * Allowed: owner, admin
     */
    public function store(StoreCouponRequest $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);

        $coupon = Coupon::create([
            'organization_id'        => $organization->id,
            'workshop_id'            => $request->input('workshop_id'),
            'created_by_user_id'     => $request->user()->id,
            'code'                   => $request->input('code'),
            'label'                  => $request->input('label'),
            'description'            => $request->input('description'),
            'discount_type'          => $request->input('discount_type'),
            'discount_pct'           => $request->input('discount_pct'),
            'discount_amount_cents'  => $request->input('discount_amount_cents'),
            'applies_to'             => $request->input('applies_to', 'all'),
            'minimum_order_cents'    => $request->input('minimum_order_cents', 0),
            'max_redemptions'        => $request->input('max_redemptions'),
            'max_redemptions_per_user' => $request->input('max_redemptions_per_user', 1),
            'is_active'              => $request->boolean('is_active', true),
            'valid_from'             => $request->input('valid_from'),
            'valid_until'            => $request->input('valid_until'),
        ]);

        $coupon->load('workshop');

        return response()->json(new CouponResource($coupon), 201);
    }

    /**
     * PATCH /api/v1/organizations/{organization}/coupons/{coupon}
     * Allowed: owner, admin
     * Code, discount_type, discount_pct, discount_amount_cents are immutable once redeemed.
     */
    public function update(UpdateCouponRequest $request, Organization $organization, Coupon $coupon): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);
        $this->assertCouponBelongsToOrg($coupon, $organization);

        $coupon->update($request->only([
            'code',
            'label',
            'description',
            'discount_type',
            'discount_pct',
            'discount_amount_cents',
            'applies_to',
            'workshop_id',
            'minimum_order_cents',
            'max_redemptions',
            'max_redemptions_per_user',
            'is_active',
            'valid_from',
            'valid_until',
        ]));

        $coupon->load('workshop');

        return response()->json(new CouponResource($coupon));
    }

    /**
     * DELETE /api/v1/organizations/{organization}/coupons/{coupon}
     * Allowed: owner, admin
     * Sets is_active = false (not a hard delete — coupon_redemptions reference the id).
     */
    public function destroy(Request $request, Organization $organization, Coupon $coupon): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);
        $this->assertCouponBelongsToOrg($coupon, $organization);

        // Remove from any active carts before deactivating.
        $activeCarts = Cart::where('applied_coupon_id', $coupon->id)
            ->where('status', 'active')
            ->get();

        foreach ($activeCarts as $cart) {
            $this->couponService->removeFromCart($cart);
        }

        $coupon->update(['is_active' => false]);

        return response()->json(['message' => 'Coupon deactivated.']);
    }

    /**
     * GET /api/v1/organizations/{organization}/coupons/{coupon}/redemptions
     * Allowed: owner, admin
     */
    public function redemptions(Request $request, Organization $organization, Coupon $coupon): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);
        $this->assertCouponBelongsToOrg($coupon, $organization);

        $workshopId = $request->input('workshop_id');

        $redemptions = $coupon->redemptions()
            ->when($workshopId, fn ($q) => $q->where('workshop_id', (int) $workshopId))
            ->with(['user', 'order', 'workshop'])
            ->latest()
            ->paginate(25);

        return response()->json([
            'data' => CouponRedemptionResource::collection($redemptions->items()),
            'meta' => [
                'current_page' => $redemptions->currentPage(),
                'last_page'    => $redemptions->lastPage(),
                'total'        => $redemptions->total(),
                'per_page'     => $redemptions->perPage(),
            ],
        ]);
    }

    /**
     * GET /api/v1/workshops/{workshop}/coupons
     * Allowed: owner, admin of the workshop's organization
     */
    public function indexForWorkshop(Request $request, Workshop $workshop): JsonResponse
    {
        $organization = $workshop->organization;

        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);

        $coupons = Coupon::where('organization_id', $organization->id)
            ->where('workshop_id', $workshop->id)
            ->with('workshop')
            ->latest()
            ->get();

        return response()->json(CouponResource::collection($coupons));
    }

    /**
     * GET /api/v1/workshops/{workshop}/coupon-redemptions
     * Allowed: owner, admin, staff
     */
    public function workshopRedemptions(Request $request, Workshop $workshop): JsonResponse
    {
        $organization = $workshop->organization;

        // Allowed: owner, admin, staff
        // Denied: billing_admin
        $this->authorizeOwnerAdminOrStaff($request, $organization);
        $this->requireOrgPayments($organization);

        $baseQuery = CouponRedemption::where('workshop_id', $workshop->id);

        $redemptions = (clone $baseQuery)
            ->with([
                'coupon:id,code,label,discount_type,discount_pct,discount_amount_cents',
                'user:id,first_name,last_name',
                'order:id,order_number,total_cents',
            ])
            ->orderByDesc('created_at')
            ->paginate($request->input('per_page', 25));

        $totalDiscountCents = (int) (clone $baseQuery)->sum('discount_amount_cents');
        $uniqueCoupons      = (clone $baseQuery)->distinct('coupon_id')->count('coupon_id');

        return response()->json([
            'data' => $redemptions->items(),
            'meta' => [
                'current_page' => $redemptions->currentPage(),
                'last_page'    => $redemptions->lastPage(),
                'total'        => $redemptions->total(),
                'per_page'     => $redemptions->perPage(),
                'summary'      => [
                    'total_redemptions'   => $redemptions->total(),
                    'total_discount'      => $this->fees->formatCents($totalDiscountCents),
                    'total_discount_cents' => $totalDiscountCents,
                    'unique_coupons_used' => $uniqueCoupons,
                ],
            ],
        ]);
    }

    /**
     * GET /api/v1/organizations/{organization}/coupons/analytics
     * Allowed: owner, admin, staff
     */
    public function analytics(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwnerAdminOrStaff($request, $organization);
        $this->requireOrgPayments($organization);

        $period = $request->input('period', 'this_month');

        [$from, $to] = $this->resolvePeriod($period);

        $redemptions = CouponRedemption::query()
            ->where('organization_id', $organization->id)
            ->whereBetween('created_at', [$from, $to]);

        $totalRedemptions   = (clone $redemptions)->count();
        $totalDiscountCents = (int) (clone $redemptions)->sum('discount_amount_cents');
        $totalRevenueCents  = (int) (clone $redemptions)->sum('post_discount_total_cents');

        $topCoupon = (clone $redemptions)
            ->select('coupon_id', DB::raw('COUNT(*) as use_count'))
            ->groupBy('coupon_id')
            ->orderByDesc('use_count')
            ->with('coupon:id,code,label')
            ->first();

        $totalOrders = Order::where('organization_id', $organization->id)
            ->whereBetween('completed_at', [$from, $to])
            ->where('status', 'completed')
            ->count();

        $ordersWithCoupon = Order::where('organization_id', $organization->id)
            ->whereBetween('completed_at', [$from, $to])
            ->where('status', 'completed')
            ->whereNotNull('coupon_id')
            ->count();

        $conversionRate = $totalOrders > 0
            ? round(($ordersWithCoupon / $totalOrders) * 100, 1)
            : 0;

        $perCoupon = (clone $redemptions)
            ->select(
                'coupon_id',
                DB::raw('COUNT(*) as redemption_count'),
                DB::raw('SUM(discount_amount_cents) as total_discount_cents'),
                DB::raw('SUM(post_discount_total_cents) as total_revenue_cents')
            )
            ->groupBy('coupon_id')
            ->with('coupon:id,code,label,discount_type,discount_pct,discount_amount_cents')
            ->orderByDesc('redemption_count')
            ->get()
            ->map(fn ($row) => [
                'coupon_id'            => $row->coupon_id,
                'code'                 => $row->coupon->code,
                'label'                => $row->coupon->label,
                'discount_type'        => $row->coupon->discount_type,
                'discount_display'     => $row->coupon->getFormattedDiscount(),
                'redemption_count'     => $row->redemption_count,
                'total_discount'       => $this->fees->formatCents((int) $row->total_discount_cents),
                'total_discount_cents' => (int) $row->total_discount_cents,
                'total_revenue'        => $this->fees->formatCents((int) $row->total_revenue_cents),
            ]);

        return response()->json([
            'data' => [
                'period'               => $period,
                'period_from'          => $from->toDateString(),
                'period_to'            => $to->toDateString(),
                'total_redemptions'    => $totalRedemptions,
                'total_discount'       => $this->fees->formatCents($totalDiscountCents),
                'total_discount_cents' => $totalDiscountCents,
                'total_revenue'        => $this->fees->formatCents($totalRevenueCents),
                'conversion_rate_pct'  => $conversionRate,
                'orders_with_coupon'   => $ordersWithCoupon,
                'total_orders'         => $totalOrders,
                'top_coupon'           => $topCoupon ? [
                    'coupon_id' => $topCoupon->coupon_id,
                    'code'      => $topCoupon->coupon->code,
                    'label'     => $topCoupon->coupon->label,
                    'use_count' => $topCoupon->use_count,
                ] : null,
                'per_coupon'           => $perCoupon,
            ],
        ]);
    }

    /**
     * POST /api/v1/organizations/{organization}/coupons/bulk-generate
     * Allowed: owner, admin
     */
    public function bulkGenerate(
        BulkGenerateCouponsRequest $request,
        Organization $organization
    ): JsonResponse {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);

        $result = $this->bulkGenerationService->generate(
            $organization,
            $request->user(),
            $request->validated()
        );

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id'   => $request->user()->id,
            'entity_type'     => 'coupon',
            'entity_id'       => null,
            'action'          => 'coupon.bulk_generated',
            'metadata'        => [
                'count'  => $result->count,
                'label'  => $result->label,
                'prefix' => $request->input('prefix'),
                'failed' => $result->failed,
            ],
        ]);

        return response()->json([
            'data' => [
                'generated'  => $result->count,
                'failed'     => $result->failed,
                'label'      => $result->label,
                'codes'      => $result->codes,
                'coupon_ids' => $result->coupon_ids,
            ],
        ], 201);
    }

    /**
     * GET /api/v1/organizations/{organization}/coupons/export
     * Allowed: owner, admin
     * Returns a CSV of all coupon codes, optionally filtered by label.
     */
    public function export(
        Request $request,
        Organization $organization
    ): \Symfony\Component\HttpFoundation\StreamedResponse {
        $this->authorizeOwnerOrAdmin($request, $organization);
        $this->requireOrgPayments($organization);

        $label = $request->input('label');

        $query = Coupon::where('organization_id', $organization->id)
            ->when($label, fn ($q) => $q->where('label', $label))
            ->orderBy('code');

        $filename = 'wayfield-coupons-' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Code', 'Label', 'Discount', 'Valid Until', 'Max Uses Per Person', 'Active']);

            $query->chunk(200, function ($coupons) use ($handle) {
                foreach ($coupons as $coupon) {
                    fputcsv($handle, [
                        $coupon->code,
                        $coupon->label,
                        $coupon->getFormattedDiscount(),
                        $coupon->valid_until?->toDateString() ?? 'Never',
                        $coupon->max_redemptions_per_user,
                        $coupon->is_active ? 'Yes' : 'No',
                    ]);
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function resolvePeriod(string $period): array
    {
        return match ($period) {
            'last_month' => [
                now()->subMonth()->startOfMonth(),
                now()->subMonth()->endOfMonth(),
            ],
            'this_year' => [
                now()->startOfYear(),
                now()->endOfYear(),
            ],
            'all_time' => [
                \Carbon\Carbon::createFromTimestamp(0),
                now(),
            ],
            default => [
                now()->startOfMonth(),
                now()->endOfMonth(),
            ],
        };
    }

    // ─── Auth helpers ─────────────────────────────────────────────────────────

    private function authorizeOwnerOrAdmin(Request $request, Organization $organization): void
    {
        // Allowed: owner, admin
        // Denied: staff, billing_admin
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(403, 'Only organization owners and admins may manage coupons.');
        }
    }

    private function authorizeOwnerAdminOrStaff(Request $request, Organization $organization): void
    {
        // Allowed: owner, admin, staff
        // Denied: billing_admin
        $role = $organization->memberRole($request->user());

        if (! in_array($role, ['owner', 'admin', 'staff'], true)) {
            abort(403, 'Only organization owners, admins, and staff may view coupon analytics.');
        }
    }

    private function requireOrgPayments(Organization $organization): void
    {
        if (! $this->flags->isOrgPaymentsEnabled($organization->id)) {
            abort(403, 'Payments have not been enabled for this organization.');
        }
    }

    private function assertCouponBelongsToOrg(Coupon $coupon, Organization $organization): void
    {
        if ($coupon->organization_id !== $organization->id) {
            abort(404);
        }
    }
}
