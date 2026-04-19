<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class PlansController extends Controller
{
    /**
     * GET /api/v1/plans
     *
     * Public endpoint — no auth required. Returns plan config for the pricing UI.
     * Cached for 1 hour; plan config almost never changes at runtime.
     */
    public function index(): JsonResponse
    {
        $plans = Cache::remember('plans.public', 3600, function () {
            $order = config('plans.order', []);

            return collect($order)->map(function (string $code) {
                return [
                    'code' => $code,
                    'display_name' => config("plans.display_names.{$code}"),
                    'monthly_cents' => config("plans.pricing.{$code}.monthly_cents"),
                    'annual_cents' => config("plans.pricing.{$code}.annual_cents"),
                    'annual_discount_pct' => config("plans.pricing.{$code}.annual_discount_pct"),
                    'limits' => config("plans.limits.{$code}"),
                    'features' => config("plans.features.{$code}"),
                    'has_stripe' => config("plans.pricing.{$code}.stripe_monthly_price_id") !== null,
                ];
            })->values()->all();
        });

        return response()->json($plans);
    }
}
