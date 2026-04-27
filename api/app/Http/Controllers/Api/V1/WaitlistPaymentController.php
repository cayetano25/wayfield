<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\WaitlistPromotionPayment;
use App\Domain\Payments\Services\WaitlistPromotionService;
use App\Http\Controllers\Controller;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WaitlistPaymentController extends Controller
{
    /**
     * GET /api/v1/workshops/{workshop}/waitlist-payment-intent
     *
     * Creates (or retrieves) a Stripe PaymentIntent for the authenticated
     * participant's active waitlist payment window.
     *
     * Auth: Bearer token. Participant must have a WaitlistPromotionPayment
     * with status = 'window_open' and window_expires_at in the future.
     *
     * Returns 404 if no active window exists.
     * Returns 422 if the window has expired.
     */
    public function show(Request $request, Workshop $workshop, WaitlistPromotionService $service): JsonResponse
    {
        $user = $request->user();

        $promotionPayment = WaitlistPromotionPayment::query()
            ->where('workshop_id', $workshop->id)
            ->where('user_id', $user->id)
            ->where('status', 'window_open')
            ->latest()
            ->first();

        if (! $promotionPayment) {
            return response()->json(['error' => 'no_active_window', 'message' => 'No active waitlist payment window found.'], 404);
        }

        if ($promotionPayment->window_expires_at->isPast()) {
            return response()->json(['error' => 'window_expired', 'message' => 'Your payment window has expired.'], 422);
        }

        $intentData = $service->prepareWaitlistPaymentIntent($promotionPayment);

        return response()->json($intentData);
    }
}
