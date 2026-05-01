<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Exceptions\AddonSessionEligibilityException;
use App\Domain\Payments\Exceptions\CartExpiredException;
use App\Domain\Payments\Exceptions\CartOrgMismatchException;
use App\Domain\Payments\Exceptions\DuplicateWorkshopInCartException;
use App\Domain\Payments\Exceptions\WorkshopNotPublishedException;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Services\CartService;
use App\Domain\Payments\Services\CheckoutService;
use App\Domain\Payments\Services\CouponService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AddCartItemRequest;
use App\Http\Requests\Api\V1\ApplyCouponRequest;
use App\Http\Resources\CartResource;
use App\Http\Resources\OrderResource;
use App\Models\Organization;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(
        private readonly CartService $cartService,
        private readonly CheckoutService $checkoutService,
        private readonly CouponService $couponService,
    ) {}

    /**
     * GET /api/v1/cart/{organization}
     */
    public function show(Request $request, Organization $organization): JsonResponse
    {
        $user = $request->user();
        $cart = $this->resolveCart($user, $organization);

        if ($cart === null) {
            // Conflicting paid cart from another org — cannot merge.
            return response()->json([
                'error'   => 'CART_ORG_MISMATCH',
                'message' => 'An active cart already exists for a different organization.',
            ], 409);
        }

        $summary = $this->cartService->getCartSummary($cart);

        return response()->json(
            (new CartResource($summary['cart']))->withFees($summary['fees'])
        );
    }

    /**
     * POST /api/v1/cart/{organization}/items
     */
    public function addItem(AddCartItemRequest $request, Organization $organization): JsonResponse
    {
        $user     = $request->user();
        $itemType = $request->input('item_type');

        // Resolve the workshop up-front so we can determine whether it's free.
        // Free workshops have no Stripe payment, so the cross-org cart guard does not apply.
        $workshop = null;
        if ($itemType === 'workshop_registration') {
            $workshop = Workshop::find($request->input('workshop_id'));
        }

        $isFreeItem = $workshop && (function () use ($workshop): bool {
            $pricing = WorkshopPricing::where('workshop_id', $workshop->id)->first();
            return $pricing === null || $pricing->base_price_cents === 0;
        })();

        if ($isFreeItem) {
            // Free item: no Stripe payment needed.
            // If a paid cart from another org is active, auto-complete this free registration
            // immediately (disposable cart → checkout → done) and return the paid cart unchanged.
            // This avoids ever having two active carts coexist, which breaks the show endpoint.
            $existingPaidCart = Cart::query()
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->where('organization_id', '!=', $organization->id)
                ->where('discounted_total_cents', '>', 0)
                ->first();

            if ($existingPaidCart) {
                $workshop = $workshop ?? Workshop::findOrFail($request->input('workshop_id'));
                $tempCart = null;
                try {
                    $tempCart = $this->cartService->getOrCreateCart($user, $organization, skipOrgMismatchCheck: true);
                    $this->cartService->addWorkshop($tempCart, $workshop);
                    $this->checkoutService->checkout($tempCart, $user);
                } catch (DuplicateWorkshopInCartException) {
                    // Already registered — treat as success.
                    // Delete the temp cart if still active so it doesn't block future show/add calls.
                    if ($tempCart !== null && $tempCart->fresh()->status === 'active') {
                        $tempCart->items()->delete();
                        $tempCart->delete();
                    }
                } catch (\Throwable $e) {
                    // Delete the temp cart so it doesn't block future show/add calls.
                    if ($tempCart !== null && $tempCart->fresh()->status === 'active') {
                        $tempCart->items()->delete();
                        $tempCart->delete();
                    }
                    return response()->json(['error' => 'CHECKOUT_FAILED', 'message' => $e->getMessage()], 422);
                }
                // Return the paid cart so the frontend stays anchored to it.
                $existingPaidCart->load('items.workshop', 'items.session', 'organization');
                $summary = $this->cartService->getCartSummary($existingPaidCart);
                return response()->json(
                    (new CartResource($summary['cart']))->withFees($summary['fees'])->additional(['auto_registered' => true]),
                    201
                );
            }

            // No paid conflict — create/get the free cart normally.
            try {
                $cart = $this->cartService->getOrCreateCart($user, $organization, skipOrgMismatchCheck: true);
            } catch (CartExpiredException $e) {
                return response()->json(['error' => 'CART_EXPIRED', 'message' => $e->getMessage()], 410);
            }
        } else {
            // Paid item: attempt to resolve the cart, auto-completing any free conflicting cart first.
            $cart = $this->resolveCart($user, $organization);

            if ($cart === null) {
                return response()->json([
                    'error'   => 'CART_ORG_MISMATCH',
                    'message' => 'You have an active cart with paid items for a different organization. '
                        . 'Complete or clear that order before adding items here.',
                ], 409);
            }
        }

        try {
            if ($itemType === 'workshop_registration') {
                $workshop = $workshop ?? Workshop::findOrFail($request->input('workshop_id'));
                $item     = $this->cartService->addWorkshop($cart, $workshop);
            } else {
                $session = Session::findOrFail($request->input('session_id'));
                $item    = $this->cartService->addAddonSession($cart, $session);
            }
        } catch (WorkshopNotPublishedException $e) {
            return response()->json(['error' => 'WORKSHOP_NOT_AVAILABLE', 'message' => $e->getMessage()], 422);
        } catch (DuplicateWorkshopInCartException $e) {
            return response()->json(['error' => 'DUPLICATE_WORKSHOP', 'message' => $e->getMessage()], 409);
        } catch (AddonSessionEligibilityException $e) {
            return response()->json(['error' => 'ADDON_SESSION_INELIGIBLE', 'message' => $e->getMessage()], 422);
        } catch (CartExpiredException $e) {
            return response()->json(['error' => 'CART_EXPIRED', 'message' => $e->getMessage()], 410);
        }

        $summary = $this->cartService->getCartSummary($cart->fresh());

        return response()->json(
            (new CartResource($summary['cart']))->withFees($summary['fees']),
            201
        );
    }

    /**
     * DELETE /api/v1/cart/{organization}/items/{cartItem}
     */
    public function removeItem(Request $request, Organization $organization, CartItem $cartItem): JsonResponse
    {
        $user = $request->user();
        $cart = $this->cartService->getOrCreateCart($user, $organization);

        if ($cartItem->cart_id !== $cart->id) {
            return response()->json(['error' => 'Item not found in your cart.'], 404);
        }

        try {
            $this->cartService->removeItem($cart, $cartItem->id);
        } catch (CartExpiredException $e) {
            return response()->json(['error' => 'CART_EXPIRED', 'message' => $e->getMessage()], 410);
        }

        $summary = $this->cartService->getCartSummary($cart->fresh());

        return response()->json(
            (new CartResource($summary['cart']))->withFees($summary['fees'])
        );
    }

    /**
     * POST /api/v1/cart/{organization}/coupon
     */
    public function applyCoupon(ApplyCouponRequest $request, Organization $organization): JsonResponse
    {
        $user = $request->user();

        try {
            $cart = $this->cartService->getOrCreateCart($user, $organization);
        } catch (CartOrgMismatchException $e) {
            return response()->json(['error' => 'CART_ORG_MISMATCH', 'message' => $e->getMessage()], 409);
        }

        if (! $cart->isActive()) {
            return response()->json(['error' => 'CART_EXPIRED', 'message' => 'Your cart has expired.'], 410);
        }

        $result = $this->couponService->applyToCart($request->input('code'), $cart, $user);

        if (! $result->isValid()) {
            return response()->json([
                'error'   => $result->errorCode,
                'message' => $result->errorMessage,
            ], 422);
        }

        $cart->refresh()->load('items.workshop', 'items.session', 'appliedCoupon');

        return response()->json([
            'data' => [
                'coupon_code'           => $result->coupon->code,
                'discount_type'         => $result->coupon->discount_type,
                'discount_pct'          => $result->coupon->discount_pct,
                'discount_amount'       => number_format($result->discountCents / 100, 2),
                'pre_discount_subtotal' => number_format($cart->subtotal_cents / 100, 2),
                'discounted_total'      => number_format($result->discountedTotalCents / 100, 2),
                'message'               => 'Coupon applied — $' . number_format($result->discountCents / 100, 2) . ' off',
            ],
        ]);
    }

    /**
     * DELETE /api/v1/cart/{organization}/coupon
     */
    public function removeCoupon(Request $request, Organization $organization): JsonResponse
    {
        $user = $request->user();

        try {
            $cart = $this->cartService->getOrCreateCart($user, $organization);
        } catch (CartOrgMismatchException $e) {
            return response()->json(['error' => 'CART_ORG_MISMATCH', 'message' => $e->getMessage()], 409);
        }

        $this->couponService->removeFromCart($cart);

        $summary = $this->cartService->getCartSummary($cart->fresh());

        return response()->json(array_merge(
            ['message' => 'Coupon removed.'],
            ['cart' => (new CartResource($summary['cart']))->withFees($summary['fees'])],
        ));
    }

    /**
     * POST /api/v1/cart/{organization}/checkout
     *
     * CRITICAL: client_secret is returned exactly once here and never persisted
     * in plaintext anywhere on the server. The frontend uses it to confirm the
     * PaymentIntent via Stripe.js / Elements.
     */
    public function checkout(Request $request, Organization $organization): JsonResponse
    {
        $user = $request->user();

        try {
            $cart = $this->cartService->getOrCreateCart($user, $organization);
        } catch (CartOrgMismatchException $e) {
            return response()->json(['error' => 'CART_ORG_MISMATCH', 'message' => $e->getMessage()], 409);
        }

        if ($cart->items()->count() === 0) {
            return response()->json(['error' => 'CART_EMPTY', 'message' => 'Your cart is empty.'], 422);
        }

        try {
            $result = $this->checkoutService->checkout($cart, $user);
        } catch (CartExpiredException $e) {
            return response()->json(['error' => 'CART_EXPIRED', 'message' => $e->getMessage()], 410);
        } catch (\App\Domain\Payments\Exceptions\StripeConnectNotReadyException $e) {
            return response()->json(['error' => 'STRIPE_NOT_READY', 'message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => 'CHECKOUT_FAILED', 'message' => $e->getMessage()], 422);
        }

        if (! $result->requiresPayment) {
            return response()->json([
                'order_number'    => $result->order->order_number,
                'status'          => $result->order->status,
                'requires_payment' => false,
                'order'           => new OrderResource($result->order->load('items')),
            ]);
        }

        // Paid path: return client_secret once; never log it.
        return response()->json([
            'order_number'          => $result->order->order_number,
            'status'                => $result->order->status,
            'requires_payment'      => true,
            'client_secret'         => $result->clientSecret,
            'stripe_publishable_key' => $result->stripePublishableKey,
        ]);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /**
     * Get or create a cart for the given org, automatically completing any
     * conflicting free cart from a different org first.
     *
     * Returns null if the conflict is a paid cart that cannot be auto-resolved.
     */
    private function resolveCart(\App\Models\User $user, Organization $organization): ?Cart
    {
        try {
            return $this->cartService->getOrCreateCart($user, $organization);
        } catch (CartOrgMismatchException $e) {
            // There is an active cart for a different org. If it's entirely free
            // (no payment needed), auto-complete it so the user can proceed.
            $conflicting = Cart::query()
                ->where('user_id', $user->id)
                ->where('status', 'active')
                ->where('organization_id', $e->existingOrgId)
                ->first();

            if ($conflicting === null || $conflicting->discounted_total_cents > 0) {
                // Paid conflict — cannot auto-resolve.
                return null;
            }

            // Free conflict — delete the cart and its items (no payment was ever taken,
            // so no registration is lost). Deleting avoids the unique constraint on
            // (user_id, organization_id, status) that prevents setting to 'abandoned'
            // when an abandoned cart for the same user+org already exists.
            $conflicting->items()->delete();
            $conflicting->delete();

            try {
                return $this->cartService->getOrCreateCart($user, $organization);
            } catch (CartOrgMismatchException) {
                return null;
            }
        }
    }
}
