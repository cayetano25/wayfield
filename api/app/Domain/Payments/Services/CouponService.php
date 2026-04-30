<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\CouponValidationResult;
use App\Domain\Payments\Models\Coupon;
use App\Domain\Payments\Models\CouponRedemption;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\Cart;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CouponService
{
    public function __construct(
        private readonly FeeCalculationService $feeCalculationService,
    ) {}

    // ─── Validation ───────────────────────────────────────────────────────────

    public function validate(string $code, Cart $cart, User $user): CouponValidationResult
    {
        // Step 1 — Find the coupon (case-insensitive within org).
        $coupon = Coupon::where('organization_id', $cart->organization_id)
            ->where('code', strtoupper(trim($code)))
            ->first();

        if (! $coupon) {
            return CouponValidationResult::error('COUPON_NOT_FOUND', 'This coupon code is not valid.');
        }

        // Step 2 — Check is_active flag (distinct from date validity).
        if (! $coupon->is_active) {
            return CouponValidationResult::error('COUPON_INACTIVE', 'This coupon is no longer active.');
        }

        // Step 3 — Check date windows with specific error codes.
        if ($coupon->valid_until && $coupon->valid_until->lt(now())) {
            return CouponValidationResult::error('COUPON_EXPIRED', 'This coupon has expired.');
        }

        if ($coupon->valid_from && $coupon->valid_from->gt(now())) {
            return CouponValidationResult::error('COUPON_NOT_YET_VALID', 'This coupon is not valid yet.');
        }

        // Step 4 — Check total usage cap.
        if ($coupon->isUsageLimitReached()) {
            return CouponValidationResult::error(
                'COUPON_LIMIT_REACHED',
                'This coupon has reached its maximum number of uses.'
            );
        }

        // Step 5 — Check per-user usage cap.
        if ($coupon->hasUserExceededLimit($user->id)) {
            return CouponValidationResult::error('COUPON_ALREADY_USED', 'You have already used this coupon.');
        }

        // Step 6 — Check workshop scope when coupon is workshop-specific.
        if ($coupon->workshop_id !== null) {
            $cartHasMatchingWorkshop = $cart->items()
                ->where('workshop_id', $coupon->workshop_id)
                ->exists();

            if (! $cartHasMatchingWorkshop) {
                return CouponValidationResult::error(
                    'COUPON_WRONG_WORKSHOP',
                    'This coupon is only valid for a specific workshop that is not in your cart.'
                );
            }
        }

        // Step 7 — Calculate applicable subtotal based on coupon scope.
        $applicableSubtotal = match ($coupon->applies_to) {
            'all'           => $cart->subtotal_cents,
            'workshop_only' => (int) $cart->items()
                ->where('item_type', 'workshop_registration')
                ->sum('line_total_cents'),
            'addons_only'   => (int) $cart->items()
                ->where('item_type', 'addon_session')
                ->sum('line_total_cents'),
        };

        if ($applicableSubtotal === 0) {
            return CouponValidationResult::error(
                'COUPON_NO_APPLICABLE_ITEMS',
                'This coupon does not apply to any items in your cart.'
            );
        }

        // Step 8 — Check minimum order requirement.
        if ($cart->subtotal_cents < $coupon->minimum_order_cents) {
            $minimumFormatted = $this->feeCalculationService->formatCents($coupon->minimum_order_cents);

            return CouponValidationResult::error(
                'COUPON_MINIMUM_NOT_MET',
                "This coupon requires a minimum order of {$minimumFormatted}."
            );
        }

        // Step 9 — Calculate discount.
        $discountCents        = $coupon->calculateDiscount($applicableSubtotal);
        $discountedTotalCents = max(0, $cart->subtotal_cents - $discountCents);

        return new CouponValidationResult(
            coupon: $coupon,
            applicableSubtotalCents: $applicableSubtotal,
            discountCents: $discountCents,
            discountedTotalCents: $discountedTotalCents,
            errorCode: null,
            errorMessage: null,
        );
    }

    // ─── Apply / Remove ───────────────────────────────────────────────────────

    public function applyToCart(string $code, Cart $cart, User $user): CouponValidationResult
    {
        $result = $this->validate($code, $cart, $user);

        if (! $result->isValid()) {
            return $result;
        }

        // Same coupon already applied — idempotent.
        if ($cart->applied_coupon_id === $result->coupon->id) {
            return $result;
        }

        $cart->update([
            'applied_coupon_id'      => $result->coupon->id,
            'coupon_code_applied'    => strtoupper(trim($code)),
            'discount_cents'         => $result->discountCents,
            'discounted_total_cents' => $result->discountedTotalCents,
        ]);

        AuditLogService::record([
            'organization_id' => $cart->organization_id,
            'actor_user_id'   => $user->id,
            'entity_type'     => 'cart',
            'entity_id'       => $cart->id,
            'action'          => 'coupon.applied',
            'metadata'        => [
                'coupon_id'      => $result->coupon->id,
                'code'           => strtoupper(trim($code)),
                'discount_cents' => $result->discountCents,
                'discount_type'  => $result->coupon->discount_type,
            ],
        ]);

        return $result;
    }

    public function removeFromCart(Cart $cart): void
    {
        if ($cart->applied_coupon_id === null) {
            return;
        }

        $previousCouponId = $cart->applied_coupon_id;
        $previousCode     = $cart->coupon_code_applied;

        $cart->update([
            'applied_coupon_id'      => null,
            'coupon_code_applied'    => null,
            'discount_cents'         => 0,
            'discounted_total_cents' => $cart->subtotal_cents,
        ]);

        AuditLogService::record([
            'organization_id' => $cart->organization_id,
            'actor_user_id'   => $cart->user_id,
            'entity_type'     => 'cart',
            'entity_id'       => $cart->id,
            'action'          => 'coupon.removed',
            'metadata'        => [
                'previous_coupon_id' => $previousCouponId,
                'previous_code'      => $previousCode,
            ],
        ]);
    }

    // ─── Redemption recording ─────────────────────────────────────────────────

    // Called from CheckoutService::fulfillOrder when order.coupon_id is set.
    // Idempotent: safe to call multiple times for the same order.
    public function recordRedemption(Order $order): void
    {
        if ($order->coupon_id === null) {
            return;
        }

        if (CouponRedemption::where('order_id', $order->id)->exists()) {
            return;
        }

        $coupon = Coupon::find($order->coupon_id);

        if (! $coupon) {
            return;
        }

        DB::transaction(function () use ($order, $coupon) {
            CouponRedemption::create([
                'coupon_id'                   => $coupon->id,
                'order_id'                    => $order->id,
                'user_id'                     => $order->user_id,
                'organization_id'             => $order->organization_id,
                'workshop_id'                 => $order->items->first()?->workshop_id,
                'discount_amount_cents'       => $order->discount_cents,
                'pre_discount_subtotal_cents' => $order->subtotal_cents,
                'post_discount_total_cents'   => $order->total_cents,
                'coupon_code_snapshot'        => $order->coupon_code,
                'discount_type_snapshot'      => $coupon->discount_type,
            ]);

            $coupon->increment('redemption_count');
            $coupon->increment('total_discount_given_cents', $order->discount_cents);
        });

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'actor_user_id'   => $order->user_id,
            'entity_type'     => 'order',
            'entity_id'       => $order->id,
            'action'          => 'coupon.redeemed',
            'metadata'        => [
                'coupon_id'               => $coupon->id,
                'order_id'               => $order->id,
                'discount_cents'         => $order->discount_cents,
                'redemption_count_after' => $coupon->redemption_count,
            ],
        ]);
    }
}
