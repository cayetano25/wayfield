<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\StripeInvoice;
use App\Models\StripeSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PlatformFinancialController extends Controller
{
    // Monthly revenue (cents) per plan code
    private const PLAN_MRR = [
        'foundation' => 0,
        'creator'    => 4900,
        'studio'     => 12900,
        'enterprise' => 49900,
    ];

    public function overview(): JsonResponse
    {
        $activeStatuses = ['active', 'trialing'];

        $byStatus = StripeSubscription::query()
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $byPlan = StripeSubscription::query()
            ->whereIn('status', $activeStatuses)
            ->selectRaw('plan_code, count(*) as count')
            ->groupBy('plan_code')
            ->pluck('count', 'plan_code');

        // MRR: null when no subscriptions exist at all (tables empty/never seeded)
        $totalSubs = StripeSubscription::count();
        $mrrCents = null;
        $arrCents = null;

        if ($totalSubs > 0) {
            $mrrCents = StripeSubscription::whereIn('status', $activeStatuses)
                ->get(['plan_code'])
                ->sum(fn ($s) => self::PLAN_MRR[$s->plan_code] ?? 0);
            $arrCents = $mrrCents * 12;
        }

        $webhookConnected = DB::table('stripe_events')
            ->whereNotNull('processed_at')
            ->exists();

        return response()->json([
            'mrr_cents'               => $mrrCents,
            'arr_cents'               => $arrCents,
            'subscriptions'           => [
                'active'   => (int) ($byStatus['active']   ?? 0),
                'trialing' => (int) ($byStatus['trialing'] ?? 0),
                'past_due' => (int) ($byStatus['past_due'] ?? 0),
                'canceled' => (int) ($byStatus['canceled'] ?? 0),
                'by_plan'  => [
                    'foundation' => (int) ($byPlan['foundation'] ?? 0),
                    'creator'    => (int) ($byPlan['creator']    ?? 0),
                    'studio'     => (int) ($byPlan['studio']     ?? 0),
                    'enterprise' => (int) ($byPlan['enterprise'] ?? 0),
                ],
            ],
            'stripe_webhook_connected' => $webhookConnected,
        ]);
    }

    public function invoices(Request $request): JsonResponse
    {
        $invoices = StripeInvoice::query()
            ->with('organization:id,name')
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('organization_id', $id))
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 25));

        $invoices->getCollection()->transform(fn (StripeInvoice $inv) => [
            'id'                => $inv->id,
            'stripe_invoice_id' => $inv->stripe_invoice_id,
            'organization_id'   => $inv->organization_id,
            'organization_name' => $inv->organization?->name,
            'amount_due'        => $inv->amount_due,
            'amount_paid'       => $inv->amount_paid,
            'currency'          => $inv->currency,
            'status'            => $inv->status,
            'invoice_pdf_url'   => $inv->invoice_pdf_url,
            'invoice_date'      => $inv->created_at?->toIso8601String(),
        ]);

        return response()->json($invoices);
    }

    /**
     * GET /api/platform/v1/financials/refund-policies
     * Paginated list of all refund policies with summary counts.
     * Returns a graceful unavailable response if the table doesn't exist yet.
     */
    public function refundPolicies(Request $request): JsonResponse
    {
        if (!Schema::hasTable('refund_policies')) {
            return response()->json([
                'summary' => [
                    'unavailable' => true,
                    'reason'      => 'refund_policies table not yet created',
                ],
                'data' => [],
            ]);
        }

        // Map the query param (policy_level) to the DB column (scope)
        $scopeFilter = match ($request->input('policy_level')) {
            'org'      => 'organization',
            'platform' => 'platform',
            'workshop' => 'workshop',
            default    => $request->input('policy_level'), // pass-through or null
        };

        // Summary counts across all policies
        $countsByScope = DB::table('refund_policies')
            ->selectRaw('scope, count(*) as count')
            ->groupBy('scope')
            ->pluck('count', 'scope');

        // Paid workshops with no workshop- or org-level refund policy
        $workshopsWithoutPolicy = 0;
        if (Schema::hasTable('workshop_pricing')) {
            $workshopsWithoutPolicy = (int) DB::table('workshops')
                ->join('workshop_pricing', 'workshops.id', '=', 'workshop_pricing.workshop_id')
                ->where('workshop_pricing.is_paid', true)
                ->whereNotExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('refund_policies')
                        ->whereColumn('refund_policies.workshop_id', 'workshops.id')
                        ->where('refund_policies.scope', 'workshop');
                })
                ->whereNotExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('refund_policies')
                        ->whereColumn('refund_policies.organization_id', 'workshops.organization_id')
                        ->where('refund_policies.scope', 'organization');
                })
                ->count();
        }

        $query = DB::table('refund_policies')
            ->leftJoin('organizations', 'refund_policies.organization_id', '=', 'organizations.id')
            ->leftJoin('workshops', 'refund_policies.workshop_id', '=', 'workshops.id')
            ->select(
                'refund_policies.*',
                'organizations.name as organization_name',
                'workshops.title as workshop_title'
            )
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('refund_policies.organization_id', $id))
            ->when($scopeFilter, fn ($q, $scope) => $q->where('refund_policies.scope', $scope))
            ->orderBy('refund_policies.created_at', 'desc');

        $policies = $query->paginate(25);

        $policies->getCollection()->transform(fn ($policy) => [
            'id'                 => $policy->id,
            'policy_level'       => $policy->scope,
            'organization_id'    => $policy->organization_id,
            'organization_name'  => $policy->organization_name,
            'workshop_id'        => $policy->workshop_id,
            'workshop_title'     => $policy->workshop_title,
            'policy_type'        => $policy->custom_policy_text ? 'custom' : 'standard',
            'custom_policy_text' => $policy->custom_policy_text,
            'is_active'          => true,
            'created_at'         => $policy->created_at,
        ]);

        $total = (int) ($countsByScope->sum());

        return response()->json([
            'summary' => [
                'total'                    => $total,
                'platform_level'           => (int) ($countsByScope['platform']     ?? 0),
                'org_level'                => (int) ($countsByScope['organization'] ?? 0),
                'workshop_level'           => (int) ($countsByScope['workshop']     ?? 0),
                'workshops_without_policy' => $workshopsWithoutPolicy,
            ],
            'data' => $policies,
        ]);
    }
}
