<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Exceptions\AddonSessionEligibilityException;
use App\Domain\Payments\Exceptions\CartExpiredException;
use App\Domain\Payments\Exceptions\CartOrgMismatchException;
use App\Domain\Payments\Exceptions\DuplicateWorkshopInCartException;
use App\Domain\Payments\Exceptions\WorkshopNotPublishedException;
use App\Domain\Payments\Models\CartItem;
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
        $user    = $request->user();
        $cart    = $this->cartService->getOrCreateCart($user, $organization);
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
        $user = $request->user();

        try {
            $cart = $this->cartService->getOrCreateCart($user, $organization);
        } catch (CartOrgMismatchException $e) {
            return response()->json([
                'error'            => 'CART_ORG_MISMATCH',
                'message'          => $e->getMessage(),
                'existing_org_id'  => $e->existingOrgId,
                'existing_org_name' => $e->existingOrgName,
            ], 409);
        }

        try {
            $itemType = $request->input('item_type');

            if ($itemType === 'workshop_registration') {
                $workshop = Workshop::findOrFail($request->input('workshop_id'));
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
}
