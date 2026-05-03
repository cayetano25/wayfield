<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\StripeInvoice;
use App\Models\StripeSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
}
