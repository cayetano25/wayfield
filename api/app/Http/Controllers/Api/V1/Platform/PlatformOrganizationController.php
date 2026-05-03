<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\FeatureFlag;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PlatformOrganizationController extends Controller
{
    public function __construct(private readonly PlatformAuditService $audit) {}

    /**
     * GET /api/platform/v1/organizations
     * Paginated list of all organizations with subscription and usage data.
     */
    public function index(Request $request): JsonResponse
    {
        $organizations = Organization::query()
            ->with(['subscription', 'organizationUsers' => fn ($q) => $q->where('is_active', true)])
            ->withCount([
                'workshops',
                'workshops as active_workshops_count' => fn ($q) => $q->where('status', 'published'),
            ])
            ->when($request->input('search'), fn ($q, $search) => $q->where(
                fn ($q) => $q->where('name', 'like', "%{$search}%")
                             ->orWhere('slug', 'like', "%{$search}%")
            ))
            ->when($request->input('plan'), fn ($q, $plan) => $q->whereHas(
                'subscription', fn ($q) => $q->where('plan_code', $plan)
            ))
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        return response()->json($organizations);
    }

    /**
     * GET /api/platform/v1/organizations/{organization}
     * Full organization detail for platform review.
     */
    public function show(Organization $organization): JsonResponse
    {
        $organization->load([
            'subscription',
            'organizationUsers.user',
            'workshops' => fn ($q) => $q->orderBy('created_at', 'desc')->limit(10),
        ]);
        $organization->loadCount(['workshops', 'organizationUsers']);

        $planCode = $organization->subscription?->plan_code ?? 'foundation';
        $limits = $this->planLimits($planCode);

        $leaderCompletion = $this->leaderCompletionSummary($organization->id);

        return response()->json([
            'id' => $organization->id,
            'name' => $organization->name,
            'slug' => $organization->slug,
            'status' => $organization->status,
            'contact_email' => $organization->primary_contact_email,
            'contact_phone' => $organization->primary_contact_phone,
            'created_at' => $organization->created_at,
            'updated_at' => $organization->updated_at,
            'subscription' => $organization->subscription ? [
                'plan_code' => $organization->subscription->plan_code,
                'status' => $organization->subscription->status,
                'current_period_start' => $organization->subscription->current_period_start,
                'current_period_end' => $organization->subscription->current_period_end,
            ] : null,
            'usage' => [
                'workshop_count' => $organization->workshops_count,
                'workshop_limit' => $limits['active_workshops'],
                'participant_count' => DB::table('registrations')
                    ->join('workshops', 'registrations.workshop_id', '=', 'workshops.id')
                    ->where('workshops.organization_id', $organization->id)
                    ->where('registrations.registration_status', 'registered')
                    ->count(),
                'participant_limit' => $limits['participants_per_workshop'],
                'manager_count' => $organization->organization_users_count,
                'manager_limit' => $limits['organizers'],
            ],
            'leader_completion' => $leaderCompletion,
        ]);
    }

    /**
     * GET /api/platform/v1/organizations/{id}/leader-completion
     * Detailed leader profile completion report for an organisation.
     */
    public function leaderCompletion(Request $request, int $id): JsonResponse
    {
        $organization = Organization::findOrFail($id);

        $leaders = DB::table('leaders')
            ->join('organization_leaders', 'leaders.id', '=', 'organization_leaders.leader_id')
            ->leftJoin('leader_invitations', function ($join) use ($id) {
                $join->on('leader_invitations.leader_id', '=', 'leaders.id')
                     ->where('leader_invitations.organization_id', '=', $id);
            })
            ->where('organization_leaders.organization_id', $id)
            ->select(
                'leaders.id',
                'leaders.first_name',
                'leaders.last_name',
                'leaders.email',
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number',
                DB::raw('MAX(leader_invitations.status) as invitation_status')
            )
            ->groupBy(
                'leaders.id',
                'leaders.first_name',
                'leaders.last_name',
                'leaders.email',
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number'
            )
            ->get();

        $leaderData = $leaders->map(function ($leader) {
            $accepted   = $leader->invitation_status === 'accepted';
            $hasBio     = !empty($leader->bio) && strlen($leader->bio) > 20;
            $hasImage   = !empty($leader->profile_image_url);
            $hasContact = !empty($leader->website_url) || !empty($leader->phone_number) || !empty($leader->email);

            $missing = [];
            if (!$accepted)   $missing[] = 'invitation not accepted';
            if (!$hasBio)     $missing[] = 'bio missing or too short';
            if (!$hasImage)   $missing[] = 'profile image missing';
            if (!$hasContact) $missing[] = 'no contact information';

            return [
                'leader_id'         => $leader->id,
                'first_name'        => $leader->first_name,
                'last_name'         => $leader->last_name,
                'email'             => $leader->email,
                'invitation_status' => $leader->invitation_status ?? 'pending',
                'profile_complete'  => $accepted && $hasBio && $hasImage && $hasContact,
                'missing_fields'    => $missing,
            ];
        });

        $total     = $leaderData->count();
        $completed = $leaderData->where('profile_complete', true)->count();
        $rate      = $total > 0 ? round(($completed / $total) * 100, 1) : 0.0;

        return response()->json([
            'organization_id'    => $organization->id,
            'organization_name'  => $organization->name,
            'total_leaders'      => $total,
            'completed_profiles' => $completed,
            'incomplete_profiles' => $total - $completed,
            'completion_rate_pct' => $rate,
            'leaders'            => $leaderData->values(),
        ]);
    }

    /**
     * PATCH /api/platform/v1/organizations/{organization}/status
     * Update organization status. Writes to platform_audit_logs.
     */
    public function updateStatus(Request $request, Organization $organization): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended', 'inactive'])],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $oldStatus = $organization->status;
        $organization->update(['status' => $data['status']]);

        $this->audit->record(
            action: 'organization.status_changed',
            adminUser: $request->user('platform_admin'),
            options: [
                'entity_type' => 'organization',
                'entity_id' => $organization->id,
                'organization_id' => $organization->id,
                'metadata_json' => [
                    'old_status' => $oldStatus,
                    'new_status' => $data['status'],
                    'reason' => $data['reason'],
                ],
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'id' => $organization->id,
            'status' => $organization->status,
        ]);
    }

    /**
     * POST /api/platform/v1/organizations/{organization}/billing/plan
     * Change an organization's subscription plan. super_admin and billing only.
     */
    public function changePlan(Request $request, Organization $organization): JsonResponse
    {
        $admin = $request->user('platform_admin');

        if (! $admin->canManageBilling()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'plan_code' => ['required', Rule::in(['foundation', 'creator', 'studio', 'enterprise'])],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $subscription = $organization->subscription;
        $oldPlan = $subscription?->plan_code ?? 'foundation';

        if ($subscription) {
            $subscription->update(['plan_code' => $data['plan_code']]);
        } else {
            $subscription = $organization->subscriptions()->create([
                'plan_code' => $data['plan_code'],
                'status' => 'active',
                'starts_at' => now(),
            ]);
        }

        $this->audit->record(
            action: 'organization.plan_changed',
            adminUser: $admin,
            options: [
                'entity_type' => 'organization',
                'entity_id' => $organization->id,
                'organization_id' => $organization->id,
                'metadata_json' => [
                    'old_plan' => $oldPlan,
                    'new_plan' => $data['plan_code'],
                    'reason' => $data['reason'],
                ],
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'organization_id' => $organization->id,
            'plan_code' => $subscription->fresh()->plan_code,
            'status' => $subscription->status,
        ]);
    }

    /**
     * GET /api/platform/v1/organizations/{organization}/feature-flags
     * Returns all feature flag definitions with this org's override state.
     */
    public function featureFlags(Organization $organization): JsonResponse
    {
        $catalog = DB::table('feature_flags')->get()->keyBy('feature_key');
        $overrides = FeatureFlag::where('organization_id', $organization->id)
            ->get()
            ->keyBy('feature_key');

        $planCode = $organization->subscription?->plan_code ?? 'foundation';

        $flags = $catalog->map(function ($definition) use ($overrides, $planCode) {
            $override = $overrides->get($definition->feature_key);
            $planDefaults = json_decode($definition->plan_defaults ?? '{}', true);
            $planDefault = $planDefaults[$planCode] ?? $definition->default_enabled;

            return [
                'feature_key' => $definition->feature_key,
                'description' => $definition->description,
                'is_enabled' => $override ? $override->is_enabled : $planDefault,
                'source' => $override ? 'manual_override' : 'plan_default',
            ];
        });

        return response()->json($flags->values());
    }

    /**
     * POST /api/platform/v1/organizations/{organization}/feature-flags
     * Set a per-org feature flag override. super_admin and admin only.
     */
    public function setFeatureFlag(Request $request, Organization $organization): JsonResponse
    {
        $data = $request->validate([
            'feature_key' => ['required', 'string', 'max:100'],
            'is_enabled' => ['required', 'boolean'],
        ]);

        $admin = $request->user('platform_admin');

        $existing = FeatureFlag::where('organization_id', $organization->id)
            ->where('feature_key', $data['feature_key'])
            ->first();
        $oldEnabled = $existing?->is_enabled;

        $flag = FeatureFlag::updateOrCreate(
            ['organization_id' => $organization->id, 'feature_key' => $data['feature_key']],
            [
                'is_enabled' => $data['is_enabled'],
                'source' => 'manual_override',
                'set_by_admin_user_id' => $admin->id,
            ]
        );

        $this->audit->record(
            action: 'feature_flag_override',
            adminUser: $admin,
            options: [
                'entity_type' => 'organization_feature_flag',
                'entity_id' => $flag->id,
                'organization_id' => $organization->id,
                'metadata_json' => [
                    'feature_key' => $data['feature_key'],
                    'old_enabled' => $oldEnabled,
                    'new_enabled' => $data['is_enabled'],
                ],
                'ip_address' => $request->ip(),
            ]
        );

        return response()->json([
            'organization_id' => $organization->id,
            'feature_key' => $flag->feature_key,
            'is_enabled' => $flag->is_enabled,
            'source' => $flag->source,
        ]);
    }

    private function leaderCompletionSummary(int $organizationId): array
    {
        $leaders = DB::table('leaders')
            ->join('organization_leaders', 'leaders.id', '=', 'organization_leaders.leader_id')
            ->leftJoin('leader_invitations', function ($join) use ($organizationId) {
                $join->on('leader_invitations.leader_id', '=', 'leaders.id')
                     ->where('leader_invitations.organization_id', '=', $organizationId);
            })
            ->where('organization_leaders.organization_id', $organizationId)
            ->select(
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number',
                'leaders.email',
                DB::raw('MAX(leader_invitations.status) as invitation_status')
            )
            ->groupBy(
                'leaders.id',
                'leaders.bio',
                'leaders.profile_image_url',
                'leaders.website_url',
                'leaders.phone_number',
                'leaders.email'
            )
            ->get();

        $total     = $leaders->count();
        $completed = $leaders->filter(function ($leader) {
            $accepted   = $leader->invitation_status === 'accepted';
            $hasBio     = !empty($leader->bio) && strlen($leader->bio) > 20;
            $hasImage   = !empty($leader->profile_image_url);
            $hasContact = !empty($leader->website_url) || !empty($leader->phone_number) || !empty($leader->email);
            return $accepted && $hasBio && $hasImage && $hasContact;
        })->count();

        return [
            'total'               => $total,
            'complete'            => $completed,
            'completion_rate_pct' => $total > 0 ? round(($completed / $total) * 100, 1) : 0.0,
        ];
    }

    /**
     * GET /api/platform/v1/organizations/{id}/sales
     * Workshop sales summary for a specific organization.
     * Reads from the orders, order_items, and refund_transactions tables.
     */
    public function orgSales(int $id): JsonResponse
    {
        // ── Summary ──────────────────────────────────────────────────────────
        $summary = DB::table('orders')
            ->where('organization_id', $id)
            ->selectRaw("
                COUNT(*) as total_orders,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_orders,
                COALESCE(SUM(CASE WHEN status IN ('completed','partially_refunded') THEN total_cents ELSE 0 END), 0) as gross_revenue_cents,
                COALESCE(SUM(CASE WHEN status IN ('completed','partially_refunded') THEN wayfield_fee_cents ELSE 0 END), 0) as wayfield_earnings_cents,
                COALESCE(SUM(CASE WHEN status IN ('completed','partially_refunded') THEN organizer_payout_cents ELSE 0 END), 0) as organizer_payout_cents,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN discount_cents ELSE 0 END), 0) as total_discount_cents,
                ROUND(COALESCE(AVG(CASE WHEN status = 'completed' THEN total_cents END), 0)) as avg_order_value_cents,
                COALESCE(COUNT(CASE WHEN is_deposit_order = 1 AND balance_paid_at IS NULL AND status = 'completed' THEN 1 END), 0) as pending_balance_count,
                COALESCE(SUM(CASE WHEN is_deposit_order = 1 AND balance_paid_at IS NULL AND status = 'completed' THEN balance_amount_cents ELSE 0 END), 0) as pending_balance_cents,
                MAX(currency) as currency
            ")
            ->first();

        // ── Actual refunds processed via Stripe ───────────────────────────────
        $refundTotal = DB::table('refund_transactions as rt')
            ->join('orders as o', 'rt.order_id', '=', 'o.id')
            ->where('o.organization_id', $id)
            ->where('rt.status', 'succeeded')
            ->selectRaw('COALESCE(SUM(rt.amount_cents), 0) as total_refunded_cents')
            ->first();

        // ── Order counts by status ────────────────────────────────────────────
        $byStatus = DB::table('orders')
            ->where('organization_id', $id)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        // ── Revenue by workshop (via order_items) ─────────────────────────────
        $byWorkshop = DB::table('order_items as oi')
            ->join('orders as o', 'oi.order_id', '=', 'o.id')
            ->join('workshops as w', 'oi.workshop_id', '=', 'w.id')
            ->where('o.organization_id', $id)
            ->whereNotNull('oi.workshop_id')
            ->whereIn('o.status', ['completed', 'partially_refunded', 'fully_refunded'])
            ->select(
                'w.id as workshop_id',
                'w.title as workshop_title',
                'w.status as workshop_status',
                DB::raw('COUNT(DISTINCT oi.order_id) as order_count'),
                DB::raw('COALESCE(SUM(oi.line_total_cents), 0) as revenue_cents'),
                DB::raw("COALESCE(SUM(CASE WHEN oi.refund_status != 'none' THEN oi.refunded_amount_cents ELSE 0 END), 0) as refunded_cents"),
                DB::raw("COUNT(CASE WHEN oi.refund_status != 'none' THEN 1 END) as refund_count")
            )
            ->groupBy('w.id', 'w.title', 'w.status')
            ->orderByDesc('revenue_cents')
            ->get();

        // ── Recent 25 orders with buyer info ──────────────────────────────────
        $recentOrders = DB::table('orders as o')
            ->leftJoin('users as u', 'o.user_id', '=', 'u.id')
            ->where('o.organization_id', $id)
            ->select(
                'o.id',
                'o.order_number',
                DB::raw("TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) as buyer_name"),
                'u.email as buyer_email',
                'o.total_cents',
                'o.currency',
                'o.status',
                'o.payment_method',
                'o.wayfield_fee_cents',
                'o.organizer_payout_cents',
                'o.discount_cents',
                'o.is_deposit_order',
                'o.completed_at',
                'o.created_at'
            )
            ->orderByDesc('o.created_at')
            ->limit(25)
            ->get();

        // Attach workshop titles to recent orders in a second query to avoid GROUP_CONCAT
        $orderIds = $recentOrders->pluck('id')->all();
        $titlesByOrder = [];
        if (!empty($orderIds)) {
            DB::table('order_items as oi')
                ->join('workshops as w', 'oi.workshop_id', '=', 'w.id')
                ->whereIn('oi.order_id', $orderIds)
                ->whereNotNull('oi.workshop_id')
                ->select('oi.order_id', 'w.title')
                ->distinct()
                ->get()
                ->each(function ($row) use (&$titlesByOrder) {
                    $titlesByOrder[$row->order_id][] = $row->title;
                });
        }

        $recentOrdersMapped = $recentOrders->map(fn ($o) => array_merge(
            (array) $o,
            ['workshop_titles' => $titlesByOrder[$o->id] ?? []]
        ));

        return response()->json([
            'summary'       => array_merge((array) $summary, [
                'total_refunded_cents' => (int) $refundTotal->total_refunded_cents,
            ]),
            'by_status'     => $byStatus,
            'by_workshop'   => $byWorkshop,
            'recent_orders' => $recentOrdersMapped,
        ]);
    }

    /**
     * GET /api/platform/v1/organizations/{id}/activity
     * Paginated tenant audit log for a specific organization.
     * Returns rows from the tenant audit_logs table (not platform_audit_logs).
     */
    public function orgActivity(Request $request, int $id): JsonResponse
    {
        $perPage = min($request->integer('per_page', 50), 100);

        $results = DB::table('audit_logs as al')
            ->leftJoin('users as u', 'al.actor_user_id', '=', 'u.id')
            ->where('al.organization_id', $id)
            ->select(
                'al.id',
                'al.action',
                'al.entity_type',
                'al.entity_id',
                'al.actor_user_id',
                DB::raw("TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) as actor_name"),
                'u.email as actor_email',
                'al.metadata_json',
                'al.created_at'
            )
            ->when($request->input('action'), fn ($q, $action) => $q->where('al.action', 'like', "%{$action}%"))
            ->when($request->input('date_from'), fn ($q, $from) => $q->where('al.created_at', '>=', $from))
            ->when($request->input('date_to'), fn ($q, $to) => $q->where('al.created_at', '<=', $to))
            ->orderBy('al.created_at', 'desc')
            ->paginate($perPage);

        return response()->json($results);
    }

    private function planLimits(string $planCode): array
    {
        return match ($planCode) {
            'creator' => ['active_workshops' => 10, 'participants_per_workshop' => 250, 'organizers' => 10],
            'studio', 'enterprise' => ['active_workshops' => null, 'participants_per_workshop' => null, 'organizers' => null],
            default => ['active_workshops' => 2, 'participants_per_workshop' => 75, 'organizers' => 3],
        };
    }
}
