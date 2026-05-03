<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PlatformWorkshopAuditController extends Controller
{
    /**
     * GET /api/platform/v1/workshops/pricing-audit
     * Paginated list of all workshops with their pricing configuration.
     */
    public function pricingAudit(Request $request): JsonResponse
    {
        $hasPricingTable        = Schema::hasTable('workshop_pricing');
        $hasTiersTable          = Schema::hasTable('workshop_price_tiers');
        $hasSessionPricingTable = Schema::hasTable('session_pricing');

        $query = Workshop::query()
            ->with('organization:id,name')
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('organization_id', $id));

        // Apply has_pricing filter at the DB layer when possible
        if ($request->has('has_pricing') && $hasPricingTable) {
            $hasPricingBool = filter_var(
                $request->input('has_pricing'),
                FILTER_VALIDATE_BOOLEAN,
                FILTER_NULL_ON_FAILURE
            );

            if ($hasPricingBool === true) {
                $query->where(function ($q) use ($hasSessionPricingTable) {
                    $q->whereExists(function ($sub) {
                        $sub->select(DB::raw(1))
                            ->from('workshop_pricing')
                            ->whereColumn('workshop_pricing.workshop_id', 'workshops.id')
                            ->where('workshop_pricing.base_price_cents', '>', 0);
                    });
                    if ($hasSessionPricingTable) {
                        $q->orWhereExists(function ($sub) {
                            $sub->select(DB::raw(1))
                                ->from('session_pricing')
                                ->join('sessions', 'session_pricing.session_id', '=', 'sessions.id')
                                ->whereColumn('sessions.workshop_id', 'workshops.id')
                                ->where('session_pricing.price_cents', '>', 0);
                        });
                    }
                });
            } elseif ($hasPricingBool === false) {
                $query->whereNotExists(function ($sub) {
                    $sub->select(DB::raw(1))
                        ->from('workshop_pricing')
                        ->whereColumn('workshop_pricing.workshop_id', 'workshops.id')
                        ->where('workshop_pricing.base_price_cents', '>', 0);
                });
                if ($hasSessionPricingTable) {
                    $query->whereNotExists(function ($sub) {
                        $sub->select(DB::raw(1))
                            ->from('session_pricing')
                            ->join('sessions', 'session_pricing.session_id', '=', 'sessions.id')
                            ->whereColumn('sessions.workshop_id', 'workshops.id')
                            ->where('session_pricing.price_cents', '>', 0);
                    });
                }
            }
        }

        $workshops   = $query->orderBy('workshops.created_at', 'desc')->paginate(25);
        $workshopIds = $workshops->getCollection()->pluck('id')->all();

        // Bulk-load pricing, tier counts, and session pricing counts to avoid N+1
        $pricingByWorkshop             = [];
        $tierCountByWorkshop           = [];
        $sessionPricingCountByWorkshop = [];

        if ($hasPricingTable && count($workshopIds) > 0) {
            $pricingByWorkshop = DB::table('workshop_pricing')
                ->whereIn('workshop_id', $workshopIds)
                ->get()
                ->keyBy('workshop_id')
                ->all();
        }

        if ($hasTiersTable && count($workshopIds) > 0) {
            $now = now();
            $tierCountByWorkshop = DB::table('workshop_price_tiers')
                ->selectRaw('workshop_id, count(*) as count')
                ->whereIn('workshop_id', $workshopIds)
                ->where('is_active', true)
                ->where(fn ($q) => $q->whereNull('valid_from')->orWhere('valid_from', '<=', $now))
                ->where(fn ($q) => $q->whereNull('valid_until')->orWhere('valid_until', '>=', $now))
                ->groupBy('workshop_id')
                ->pluck('count', 'workshop_id')
                ->all();
        }

        if ($hasSessionPricingTable && count($workshopIds) > 0) {
            $sessionPricingCountByWorkshop = DB::table('session_pricing')
                ->join('sessions', 'session_pricing.session_id', '=', 'sessions.id')
                ->selectRaw('sessions.workshop_id, count(*) as count')
                ->whereIn('sessions.workshop_id', $workshopIds)
                ->groupBy('sessions.workshop_id')
                ->pluck('count', 'workshop_id')
                ->all();
        }

        $workshops->getCollection()->transform(
            function (Workshop $workshop) use (
                $pricingByWorkshop,
                $tierCountByWorkshop,
                $sessionPricingCountByWorkshop
            ) {
                $pricing            = $pricingByWorkshop[$workshop->id] ?? null;
                $sessionPricingCount = (int) ($sessionPricingCountByWorkshop[$workshop->id] ?? 0);
                $hasPricing         = $pricing && ($pricing->base_price_cents > 0 || $sessionPricingCount > 0);

                return [
                    'workshop_id'       => $workshop->id,
                    'title'             => $workshop->title,
                    'organization_id'   => $workshop->organization_id,
                    'organization_name' => $workshop->organization?->name,
                    'status'            => $workshop->status,
                    'pricing'           => [
                        'has_pricing'          => $hasPricing,
                        'base_price_cents'     => $pricing?->base_price_cents,
                        'currency'             => $pricing?->currency,
                        'deposit_enabled'      => (bool) ($pricing?->deposit_enabled ?? false),
                        'deposit_amount_cents' => $pricing?->deposit_amount_cents,
                        'active_tier_count'    => (int) ($tierCountByWorkshop[$workshop->id] ?? 0),
                        'session_pricing_count' => $sessionPricingCount,
                    ],
                ];
            }
        );

        return response()->json($workshops);
    }

    /**
     * GET /api/platform/v1/workshops/readiness
     * Paginated list of workshops with computed readiness scores, ordered worst-first.
     * Supports in-memory score filtering (min_score / max_score).
     */
    public function readiness(Request $request): JsonResponse
    {
        $minScore = $request->integer('min_score', 0);
        $maxScore = $request->integer('max_score', 100);
        $page     = max(1, $request->integer('page', 1));
        $perPage  = 25;

        $allWorkshops = Workshop::query()
            ->with(['organization:id,name', 'logistics'])
            ->withCount([
                'sessions',
                'sessions as virtual_sessions_count'          => fn ($q) => $q->whereIn('delivery_type', ['virtual', 'hybrid']),
                'sessions as virtual_sessions_with_url_count' => fn ($q) => $q->whereIn('delivery_type', ['virtual', 'hybrid'])->whereNotNull('meeting_url'),
            ])
            ->when($request->input('organization_id'), fn ($q, $id) => $q->where('organization_id', $id))
            ->when($request->input('status'), fn ($q, $status) => $q->where('status', $status))
            ->get();

        $workshopIds = $allWorkshops->pluck('id')->all();

        // Bulk-load confirmed leader counts via workshop_leaders.is_confirmed
        $confirmedLeaderCounts = [];
        if (count($workshopIds) > 0) {
            $confirmedLeaderCounts = DB::table('workshop_leaders')
                ->selectRaw('workshop_id, count(*) as count')
                ->whereIn('workshop_id', $workshopIds)
                ->where('is_confirmed', true)
                ->groupBy('workshop_id')
                ->pluck('count', 'workshop_id')
                ->all();
        }

        $scored = $allWorkshops
            ->map(fn (Workshop $w) => $this->computeReadiness($w, (int) ($confirmedLeaderCounts[$w->id] ?? 0)))
            ->filter(fn ($item) => $item['readiness_score'] >= $minScore && $item['readiness_score'] <= $maxScore)
            ->sortBy('readiness_score')
            ->values();

        $total = $scored->count();
        $items = $scored->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'data'         => $items,
            'total'        => $total,
            'per_page'     => $perPage,
            'current_page' => $page,
            'last_page'    => max(1, (int) ceil($total / $perPage)),
        ]);
    }

    private function computeReadiness(Workshop $workshop, int $confirmedLeaderCount): array
    {
        $score   = 0;
        $missing = [];

        // 1. title (10 pts)
        if (!empty(trim($workshop->title ?? ''))) {
            $score += 10;
        } else {
            $missing[] = 'title is missing';
        }

        // 2. description > 50 chars (10 pts)
        if (!empty($workshop->description) && strlen($workshop->description) > 50) {
            $score += 10;
        } else {
            $missing[] = 'description is missing or too short';
        }

        // 3. start_date and end_date set, start < end (10 pts)
        if ($workshop->start_date && $workshop->end_date && $workshop->start_date < $workshop->end_date) {
            $score += 10;
        } else {
            $missing[] = 'start date and end date not set or invalid';
        }

        // 4. timezone (5 pts)
        if (!empty($workshop->timezone)) {
            $score += 5;
        } else {
            $missing[] = 'timezone is not set';
        }

        // 5. default_location_id OR has virtual sessions (10 pts)
        if ($workshop->default_location_id !== null || $workshop->virtual_sessions_count > 0) {
            $score += 10;
        } else {
            $missing[] = 'no location set and no virtual sessions';
        }

        // 6. at least one session (15 pts)
        if ($workshop->sessions_count > 0) {
            $score += 15;
        } else {
            $missing[] = 'no sessions added';
        }

        // 7. at least one confirmed leader (15 pts)
        if ($confirmedLeaderCount > 0) {
            $score += 15;
        } else {
            $missing[] = 'no confirmed leader assigned';
        }

        // 8. virtual/hybrid sessions all have meeting_url (10 pts)
        if ($workshop->virtual_sessions_count === 0) {
            $score += 10; // no virtual sessions — full points
        } elseif ($workshop->virtual_sessions_with_url_count >= $workshop->virtual_sessions_count) {
            $score += 10;
        } else {
            $missing[] = 'some virtual sessions are missing a meeting URL';
        }

        // 9. logistics filled (hotel_name or meetup_instructions) (5 pts)
        $logistics = $workshop->logistics;
        if ($logistics && (!empty($logistics->hotel_name) || !empty($logistics->meetup_instructions))) {
            $score += 5;
        } else {
            $missing[] = 'no logistics information provided';
        }

        // 10. public page enabled (10 pts)
        if ($workshop->public_page_enabled) {
            $score += 10;
        } else {
            $missing[] = 'public page not enabled';
        }

        return [
            'workshop_id'       => $workshop->id,
            'title'             => $workshop->title,
            'organization_id'   => $workshop->organization_id,
            'organization_name' => $workshop->organization?->name,
            'status'            => $workshop->status,
            'readiness_score'   => $score,
            'missing_items'     => $missing,
            'ready_to_publish'  => $score >= 80,
        ];
    }
}
