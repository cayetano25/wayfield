<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentControlController extends Controller
{
    public function __construct(private readonly PlatformAuditService $audit) {}

    // ─── Platform-level status ────────────────────────────────────────────────

    public function status(Request $request): JsonResponse
    {
        $platformFlag = DB::table('payment_feature_flags')
            ->where('scope', 'platform')
            ->where('flag_key', 'payments_enabled')
            ->first();

        $orgsEnabled = DB::table('payment_feature_flags')
            ->where('scope', 'organization')
            ->where('flag_key', 'org_payments_enabled')
            ->where('is_enabled', true)
            ->count();

        $stripeConnected = DB::table('stripe_connect_accounts')->count();
        $stripeCharges   = DB::table('stripe_connect_accounts')
            ->where('charges_enabled', true)
            ->count();

        $platformEnabled = (bool) ($platformFlag?->is_enabled ?? false);
        $warning         = null;
        if ($orgsEnabled > 0 && ! $platformEnabled) {
            $warning = "{$orgsEnabled} organisation(s) have payments enabled but the global platform payments switch is OFF — they cannot process payments.";
        }

        return response()->json([
            'platform_payments_enabled'          => $platformEnabled,
            'enabled_at'                         => $platformFlag?->enabled_at,
            'orgs_payment_enabled_count'         => $orgsEnabled,
            'orgs_stripe_connected_count'        => $stripeConnected,
            'orgs_stripe_charges_enabled_count'  => $stripeCharges,
            'warning'                            => $warning,
        ]);
    }

    public function enablePlatform(Request $request): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'billing'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $previous = (bool) DB::table('payment_feature_flags')
            ->where('scope', 'platform')
            ->where('flag_key', 'payments_enabled')
            ->value('is_enabled');

        DB::table('payment_feature_flags')->updateOrInsert(
            ['scope' => 'platform', 'flag_key' => 'payments_enabled'],
            ['is_enabled' => true, 'enabled_at' => now(), 'created_at' => now(), 'updated_at' => now()]
        );

        $this->audit->record(
            action: 'platform_payments.enabled',
            adminUser: $request->user(),
            options: [
                'metadata_json' => ['previous_state' => $previous],
                'ip_address'    => $request->ip(),
            ]
        );

        return $this->status($request);
    }

    public function disablePlatform(Request $request): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'billing'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        DB::table('payment_feature_flags')->updateOrInsert(
            ['scope' => 'platform', 'flag_key' => 'payments_enabled'],
            ['is_enabled' => false, 'enabled_at' => null, 'created_at' => now(), 'updated_at' => now()]
        );

        $this->audit->record(
            action: 'platform_payments.disabled',
            adminUser: $request->user(),
            options: ['ip_address' => $request->ip()]
        );

        return $this->status($request);
    }

    // ─── Per-organisation status and toggles ──────────────────────────────────

    public function orgStatus(Request $request, int $id): JsonResponse
    {
        $org = Organization::findOrFail($id);

        $orgFlag = DB::table('payment_feature_flags')
            ->where('scope', 'organization')
            ->where('organization_id', $id)
            ->where('flag_key', 'org_payments_enabled')
            ->first();

        $connect = DB::table('stripe_connect_accounts')
            ->where('organization_id', $id)
            ->first();

        $depositsFlag = DB::table('payment_feature_flags')
            ->where('scope', 'organization')
            ->where('organization_id', $id)
            ->where('flag_key', 'deposits_enabled')
            ->first();

        $waitlistFlag = DB::table('payment_feature_flags')
            ->where('scope', 'organization')
            ->where('organization_id', $id)
            ->where('flag_key', 'waitlist_payments')
            ->first();

        $platformEnabled = DB::table('payment_feature_flags')
            ->where('scope', 'platform')
            ->where('flag_key', 'payments_enabled')
            ->where('is_enabled', true)
            ->exists();

        $orgEnabled     = (bool) ($orgFlag?->is_enabled ?? false);
        $chargesEnabled = (bool) ($connect?->charges_enabled ?? false);

        return response()->json([
            'organization_id'        => $org->id,
            'organization_name'      => $org->name,
            'org_payments_enabled'   => $orgEnabled,
            'stripe_connect'         => $connect ? [
                'connected'                => true,
                'onboarding_status'        => $connect->onboarding_status,
                'charges_enabled'          => (bool) $connect->charges_enabled,
                'payouts_enabled'          => (bool) $connect->payouts_enabled,
                'details_submitted'        => (bool) $connect->details_submitted,
                'stripe_account_id'        => $connect->stripe_account_id,
                'last_webhook_received_at' => $connect->last_webhook_received_at,
                'requirements'             => $connect->requirements_json
                    ? json_decode($connect->requirements_json, true)
                    : null,
            ] : [
                'connected'                => false,
                'onboarding_status'        => null,
                'charges_enabled'          => false,
                'payouts_enabled'          => false,
                'details_submitted'        => false,
                'stripe_account_id'        => null,
                'last_webhook_received_at' => null,
                'requirements'             => null,
            ],
            'flags'                  => [
                'deposits_enabled' => (bool) ($depositsFlag?->is_enabled ?? false),
                'waitlist_payments' => (bool) ($waitlistFlag?->is_enabled ?? false),
            ],
            'effective_payments_active' => $platformEnabled && $orgEnabled && $chargesEnabled,
        ]);
    }

    public function enableOrg(Request $request, int $id): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'billing'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $org = Organization::findOrFail($id);

        DB::table('payment_feature_flags')->updateOrInsert(
            ['scope' => 'organization', 'organization_id' => $id, 'flag_key' => 'org_payments_enabled'],
            ['is_enabled' => true, 'enabled_at' => now(), 'created_at' => now(), 'updated_at' => now()]
        );

        $this->audit->record(
            action: 'org_payments.enabled',
            adminUser: $request->user(),
            options: [
                'entity_type'     => 'organization',
                'entity_id'       => $org->id,
                'organization_id' => $org->id,
                'ip_address'      => $request->ip(),
            ]
        );

        return $this->orgStatus($request, $id);
    }

    public function disableOrg(Request $request, int $id): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'billing'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $org = Organization::findOrFail($id);

        DB::table('payment_feature_flags')->updateOrInsert(
            ['scope' => 'organization', 'organization_id' => $id, 'flag_key' => 'org_payments_enabled'],
            ['is_enabled' => false, 'enabled_at' => null, 'created_at' => now(), 'updated_at' => now()]
        );

        $this->audit->record(
            action: 'org_payments.disabled',
            adminUser: $request->user(),
            options: [
                'entity_type'     => 'organization',
                'entity_id'       => $org->id,
                'organization_id' => $org->id,
                'ip_address'      => $request->ip(),
            ]
        );

        return $this->orgStatus($request, $id);
    }

    public function setOrgFlag(Request $request, int $id, string $flag_key): JsonResponse
    {
        if (! in_array($request->user()->role, ['super_admin', 'billing'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $allowed = ['deposits_enabled', 'waitlist_payments'];
        if (! in_array($flag_key, $allowed, true)) {
            return response()->json([
                'message' => 'Invalid flag key.',
                'allowed' => $allowed,
            ], 422);
        }

        $org  = Organization::findOrFail($id);
        $data = $request->validate(['is_enabled' => ['required', 'boolean']]);

        DB::table('payment_feature_flags')->updateOrInsert(
            ['scope' => 'organization', 'organization_id' => $id, 'flag_key' => $flag_key],
            [
                'is_enabled' => $data['is_enabled'],
                'enabled_at' => $data['is_enabled'] ? now() : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        $this->audit->record(
            action: 'org_payment_flag.updated',
            adminUser: $request->user(),
            options: [
                'entity_type'     => 'organization',
                'entity_id'       => $org->id,
                'organization_id' => $org->id,
                'metadata_json'   => ['flag_key' => $flag_key, 'is_enabled' => $data['is_enabled']],
                'ip_address'      => $request->ip(),
            ]
        );

        return response()->json([
            'organization_id' => $org->id,
            'flag_key'        => $flag_key,
            'is_enabled'      => $data['is_enabled'],
        ]);
    }

    // ─── Take rates ───────────────────────────────────────────────────────────

    private const TAKE_RATE_DISPLAY_NAMES = [
        'foundation' => 'Foundation',
        'creator'    => 'Creator',
        'studio'     => 'Studio',
        'custom'     => 'Enterprise',
    ];

    public function takeRates(Request $request): JsonResponse
    {
        $rates = DB::table('platform_take_rates')
            ->orderBy('id')
            ->get()
            ->map(fn ($row) => $this->formatTakeRate($row));

        return response()->json(['data' => $rates]);
    }

    public function updateTakeRate(Request $request, string $plan_code): JsonResponse
    {
        if ($request->user()->role !== 'super_admin') {
            return response()->json(['message' => 'Forbidden. Only super admins can edit take rates.'], 403);
        }

        if (! array_key_exists($plan_code, self::TAKE_RATE_DISPLAY_NAMES)) {
            return response()->json(['message' => 'Plan code not found.'], 404);
        }

        $exists = DB::table('platform_take_rates')->where('plan_code', $plan_code)->exists();
        if (! $exists) {
            return response()->json(['message' => 'Plan code not found.'], 404);
        }

        $data = $request->validate([
            'take_rate_pct' => ['required', 'numeric', 'min:0', 'max:0.2000'],
            'notes'         => ['nullable', 'string', 'max:1000'],
        ]);

        $old = DB::table('platform_take_rates')
            ->where('plan_code', $plan_code)
            ->value('take_rate_pct');

        DB::table('platform_take_rates')
            ->where('plan_code', $plan_code)
            ->update([
                'take_rate_pct' => $data['take_rate_pct'],
                'notes'         => $data['notes'] ?? null,
                'updated_at'    => now(),
            ]);

        $this->audit->record(
            action: 'take_rate.updated',
            adminUser: $request->user(),
            options: [
                'entity_type'   => 'platform_take_rate',
                'metadata_json' => [
                    'old_take_rate_pct' => (float) $old,
                    'new_take_rate_pct' => (float) $data['take_rate_pct'],
                    'plan_code'         => $plan_code,
                    'notes'             => $data['notes'] ?? null,
                ],
                'ip_address' => $request->ip(),
            ]
        );

        $updated = DB::table('platform_take_rates')
            ->where('plan_code', $plan_code)
            ->first();

        return response()->json($this->formatTakeRate($updated));
    }

    private function formatTakeRate(object $row): array
    {
        $pct = (float) $row->take_rate_pct;

        return [
            'plan_code'         => $row->plan_code,
            'display_name'      => self::TAKE_RATE_DISPLAY_NAMES[$row->plan_code] ?? $row->plan_code,
            'take_rate_pct'     => number_format($pct * 100, 2),
            'take_rate_decimal' => $pct,
            'fee_on_100'        => '$' . number_format($pct * 100, 2),
            'is_active'         => (bool) $row->is_active,
            'notes'             => $row->notes,
            'updated_at'        => $row->updated_at,
        ];
    }

    // ─── Stripe Connect oversight ─────────────────────────────────────────────

    public function connectAccounts(Request $request): JsonResponse
    {
        $query = DB::table('stripe_connect_accounts as sca')
            ->join('organizations as o', 'o.id', '=', 'sca.organization_id')
            ->select([
                'sca.organization_id',
                'o.name as organization_name',
                'sca.stripe_account_id',
                'sca.onboarding_status',
                'sca.charges_enabled',
                'sca.payouts_enabled',
                'sca.details_submitted',
                'sca.country',
                'sca.last_webhook_received_at',
                'sca.requirements_json',
            ]);

        if ($request->has('onboarding_status')) {
            $query->where('sca.onboarding_status', $request->input('onboarding_status'));
        }

        if ($request->has('charges_enabled')) {
            $query->where('sca.charges_enabled', filter_var($request->input('charges_enabled'), FILTER_VALIDATE_BOOLEAN));
        }

        $paginator = $query->paginate(25);

        $items = collect($paginator->items())->map(function ($row) {
            $requirements    = $row->requirements_json ? json_decode($row->requirements_json, true) : null;
            $hasPendingReqs  = $requirements !== null && is_array($requirements) && count($requirements) > 0;

            return [
                'organization_id'          => $row->organization_id,
                'organization_name'        => $row->organization_name,
                'stripe_account_id'        => $row->stripe_account_id,
                'onboarding_status'        => $row->onboarding_status,
                'charges_enabled'          => (bool) $row->charges_enabled,
                'payouts_enabled'          => (bool) $row->payouts_enabled,
                'details_submitted'        => (bool) $row->details_submitted,
                'country'                  => $row->country,
                'last_webhook_received_at' => $row->last_webhook_received_at,
                'has_pending_requirements' => $hasPendingReqs,
            ];
        });

        return response()->json([
            'data'         => $items,
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
        ]);
    }

    public function connectAccountDetail(Request $request, int $organization_id): JsonResponse
    {
        $connect = DB::table('stripe_connect_accounts as sca')
            ->join('organizations as o', 'o.id', '=', 'sca.organization_id')
            ->where('sca.organization_id', $organization_id)
            ->select(['sca.*', 'o.name as organization_name'])
            ->first();

        if (! $connect) {
            return response()->json(['message' => 'Stripe Connect account not found for this organisation.'], 404);
        }

        return response()->json([
            'organization_id'          => $connect->organization_id,
            'organization_name'        => $connect->organization_name,
            'stripe_account_id'        => $connect->stripe_account_id,
            'onboarding_status'        => $connect->onboarding_status,
            'charges_enabled'          => (bool) $connect->charges_enabled,
            'payouts_enabled'          => (bool) $connect->payouts_enabled,
            'details_submitted'        => (bool) $connect->details_submitted,
            'country'                  => $connect->country,
            'default_currency'         => $connect->default_currency,
            'onboarding_completed_at'  => $connect->onboarding_completed_at,
            'deauthorized_at'          => $connect->deauthorized_at,
            'last_webhook_received_at' => $connect->last_webhook_received_at,
            'capabilities'             => $connect->capabilities_json
                ? json_decode($connect->capabilities_json, true)
                : null,
            'requirements'             => $connect->requirements_json
                ? json_decode($connect->requirements_json, true)
                : null,
            'created_at'               => $connect->created_at,
            'updated_at'               => $connect->updated_at,
        ]);
    }
}
