<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Exceptions\AddonSessionEligibilityException;
use App\Domain\Payments\Exceptions\CartExpiredException;
use App\Domain\Payments\Exceptions\CartOrgMismatchException;
use App\Domain\Payments\Exceptions\DuplicateWorkshopInCartException;
use App\Domain\Payments\Exceptions\WorkshopNotPublishedException;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\SessionPricing;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Support\Facades\Log;

class CartService
{
    private const CART_TTL_HOURS = 24;

    public function __construct(
        private readonly FeeCalculationService $feeCalculationService,
        private readonly CouponService $couponService,
        private readonly PriceResolutionService $priceResolutionService,
    ) {}

    /**
     * Return the active cart for user+org, or create one.
     *
     * Throws CartOrgMismatchException if the user has an active cart for a
     * different organization — the frontend must warn and allow the user to
     * abandon the other cart first.
     */
    public function getOrCreateCart(User $user, Organization $org): Cart
    {
        // Check for any active cart belonging to a *different* org.
        $otherCart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->where('organization_id', '!=', $org->id)
            ->with('organization')
            ->first();

        if ($otherCart !== null) {
            throw new CartOrgMismatchException(
                existingOrgId: $otherCart->organization_id,
                existingOrgName: $otherCart->organization->name,
            );
        }

        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('organization_id', $org->id)
            ->where('status', 'active')
            ->first();

        if ($cart !== null) {
            // Expire carts whose TTL has lapsed.
            if ($cart->expires_at->isPast()) {
                $cart->update(['status' => 'expired']);
                $cart = null;
            }
        }

        if ($cart === null) {
            $cart = Cart::create([
                'user_id'          => $user->id,
                'organization_id'  => $org->id,
                'status'           => 'active',
                'subtotal_cents'   => 0,
                'currency'         => 'usd',
                'expires_at'       => now()->addHours(self::CART_TTL_HOURS),
                'last_activity_at' => now(),
            ]);
        }

        return $cart;
    }

    /**
     * Add a workshop registration item to the cart.
     *
     * Uses PriceResolutionService as the single source of truth for pricing.
     * If the workshop has deposit pricing, the cart item is created as a
     * deposit item; the balance is stored as metadata for display.
     */
    public function addWorkshop(Cart $cart, Workshop $workshop): CartItem
    {
        $this->assertCartActive($cart);

        if ($workshop->status !== 'published') {
            throw new WorkshopNotPublishedException;
        }

        if ($workshop->organization_id !== $cart->organization_id) {
            throw new WorkshopNotPublishedException;
        }

        $this->assertNoWorkshopDuplicate($cart, $workshop);

        $resolution = $this->priceResolutionService->resolve($workshop);

        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        $isDeposit       = false;
        $unitPriceCents  = $resolution->priceCents;
        $depositAmtCents = null;
        $balanceAmtCents = null;
        $balanceDueDate  = null;

        // Deposit mode: use deposit amount as the charge price, preserve balance info.
        // Deposit overrides tier pricing — tier applies to the full price, not the deposit split.
        if ($pricing !== null && $pricing->deposit_enabled && $pricing->deposit_amount_cents > 0) {
            $isDeposit       = true;
            $unitPriceCents  = $pricing->deposit_amount_cents;
            $depositAmtCents = $pricing->deposit_amount_cents;
            $balanceAmtCents = $resolution->priceCents - $pricing->deposit_amount_cents;
            $balanceDueDate  = $pricing->balance_due_date;
        }

        // Check for an abandoned cart with this workshop — detect price increases.
        $this->detectAndNotifyPriceIncrease($cart, $workshop, $resolution->priceCents);

        $item = CartItem::create([
            'cart_id'              => $cart->id,
            'item_type'            => 'workshop_registration',
            'workshop_id'          => $workshop->id,
            'unit_price_cents'     => $unitPriceCents,
            'applied_tier_id'      => $resolution->tierId,
            'applied_tier_label'   => $resolution->tierLabel,
            'is_tier_price'        => $resolution->isTierPrice,
            'quantity'             => 1,
            'line_total_cents'     => $unitPriceCents,
            'is_deposit'           => $isDeposit,
            'deposit_amount_cents' => $depositAmtCents,
            'balance_amount_cents' => $balanceAmtCents,
            'balance_due_date'     => $balanceDueDate,
            'currency'             => $cart->currency,
        ]);

        $this->recalculateSubtotal($cart);
        $this->refreshCouponDiscount($cart);

        return $item;
    }

    private function detectAndNotifyPriceIncrease(Cart $cart, Workshop $workshop, int $newPriceCents): void
    {
        $abandonedItem = CartItem::query()
            ->whereHas('cart', fn ($q) => $q
                ->where('user_id', $cart->user_id)
                ->whereIn('status', ['abandoned', 'expired'])
            )
            ->where('item_type', 'workshop_registration')
            ->where('workshop_id', $workshop->id)
            ->latest()
            ->first();

        if ($abandonedItem === null) {
            return;
        }

        if ($newPriceCents <= $abandonedItem->unit_price_cents) {
            return;
        }

        // Price increased — schedule the in-app notification N-70 immediately.
        ScheduledPaymentJob::create([
            'job_type'            => 'price_tier_capacity_check',
            'notification_code'   => 'N-70',
            'related_entity_type' => 'workshop',
            'related_entity_id'   => $workshop->id,
            'user_id'             => $cart->user_id,
            'scheduled_for'       => now(),
            'status'              => 'pending',
        ]);
    }

    /**
     * Add an add-on session to the cart.
     *
     * Eligibility: the user must either have an active registration for the
     * parent workshop OR a workshop CartItem already in this cart (same-checkout
     * purchase). The session must be of type addon or invite_only and have
     * enrollment_mode in (organizer_assign_only, purchase_required).
     */
    public function addAddonSession(Cart $cart, Session $session): CartItem
    {
        $this->assertCartActive($cart);

        if (! in_array($session->session_type, ['addon', 'invite_only'], true)) {
            throw new AddonSessionEligibilityException(
                'Only add-on or invite-only sessions can be purchased.'
            );
        }

        if (! in_array($session->enrollment_mode, ['organizer_assign_only', 'purchase_required'], true)) {
            throw new AddonSessionEligibilityException(
                'This session does not require a purchase.'
            );
        }

        $user     = $cart->user;
        $workshop = $session->workshop;

        // Confirm the user is eligible (registered, or has a workshop item in the same cart).
        $hasRegistration = Registration::query()
            ->where('user_id', $user->id)
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->exists();

        if (! $hasRegistration) {
            $hasWorkshopInCart = CartItem::query()
                ->where('cart_id', $cart->id)
                ->where('item_type', 'workshop_registration')
                ->where('workshop_id', $workshop->id)
                ->exists();

            if (! $hasWorkshopInCart) {
                throw new AddonSessionEligibilityException(
                    'You must be registered for the parent workshop to purchase this add-on session.'
                );
            }
        }

        $pricing = SessionPricing::query()
            ->where('session_id', $session->id)
            ->first();

        if ($pricing === null) {
            throw new AddonSessionEligibilityException(
                'This session does not have pricing configured. Contact the organizer.'
            );
        }

        $item = CartItem::create([
            'cart_id'          => $cart->id,
            'item_type'        => 'addon_session',
            'session_id'       => $session->id,
            'workshop_id'      => $workshop->id,
            'unit_price_cents' => $pricing->price_cents,
            'quantity'         => 1,
            'line_total_cents' => $pricing->price_cents,
            'is_deposit'       => false,
            'currency'         => $cart->currency,
        ]);

        $this->recalculateSubtotal($cart);
        $this->refreshCouponDiscount($cart);

        return $item;
    }

    /**
     * Remove an item from the cart and recalculate the subtotal.
     */
    public function removeItem(Cart $cart, int $cartItemId): void
    {
        $this->assertCartActive($cart);

        $item = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where('id', $cartItemId)
            ->firstOrFail();

        $removedItemType  = $item->item_type;
        $removedWorkshopId = $item->workshop_id;

        $item->delete();

        $this->recalculateSubtotal($cart);

        // If a workshop-scoped coupon was applied and its workshop was just removed,
        // the coupon is no longer applicable — re-validate to catch this.
        if ($cart->applied_coupon_id !== null) {
            if ($removedItemType === 'workshop_registration' && $removedWorkshopId !== null) {
                // Quick check: if the coupon is scoped to this specific workshop, remove it.
                $appliedCoupon = \App\Domain\Payments\Models\Coupon::find($cart->applied_coupon_id);
                if ($appliedCoupon && $appliedCoupon->workshop_id === $removedWorkshopId) {
                    $this->couponService->removeFromCart($cart);
                    return;
                }
            }

            $this->refreshCouponDiscount($cart);
        }
    }

    /**
     * Return the cart with its items and fee breakdown for display.
     */
    public function getCartSummary(Cart $cart): array
    {
        $cart->load('items.workshop', 'items.session', 'organization');

        $planCode = $cart->organization->activeSubscription?->plan_code ?? 'free';
        $fees     = $this->feeCalculationService->calculateFees(
            $cart->subtotal_cents,
            $planCode,
            $cart->currency,
        );

        return [
            'cart'  => $cart,
            'fees'  => $fees,
        ];
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function assertCartActive(Cart $cart): void
    {
        if ($cart->status !== 'active' || $cart->expires_at->isPast()) {
            throw new CartExpiredException;
        }
    }

    private function assertNoWorkshopDuplicate(Cart $cart, Workshop $workshop): void
    {
        // Already in this cart?
        $inCart = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where('item_type', 'workshop_registration')
            ->where('workshop_id', $workshop->id)
            ->exists();

        if ($inCart) {
            throw new DuplicateWorkshopInCartException;
        }

        // Already registered?
        $registered = Registration::query()
            ->where('user_id', $cart->user_id)
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->exists();

        if ($registered) {
            throw new DuplicateWorkshopInCartException;
        }
    }

    private function recalculateSubtotal(Cart $cart): void
    {
        $subtotal = (int) CartItem::query()
            ->where('cart_id', $cart->id)
            ->sum('line_total_cents');

        // Keep discounted_total in sync: subtotal - applied discount.
        // When no coupon, discount_cents = 0, so discounted_total = subtotal.
        $discountedTotal = max(0, $subtotal - $cart->discount_cents);

        $cart->update([
            'subtotal_cents'         => $subtotal,
            'discounted_total_cents' => $discountedTotal,
            'last_activity_at'       => now(),
        ]);
    }

    private function refreshCouponDiscount(Cart $cart): void
    {
        if ($cart->applied_coupon_id === null) {
            return;
        }

        $user = User::find($cart->user_id);

        if (! $user) {
            return;
        }

        $result = $this->couponService->validate($cart->coupon_code_applied, $cart, $user);

        if (! $result->isValid()) {
            // Coupon is no longer valid for the new cart state — auto-remove it.
            Log::info('CartService: auto-removing invalid coupon after cart change', [
                'cart_id'    => $cart->id,
                'coupon_id'  => $cart->applied_coupon_id,
                'error_code' => $result->errorCode,
            ]);
            $this->couponService->removeFromCart($cart);
            return;
        }

        // Recalculate discount for the new subtotal.
        $cart->update([
            'discount_cents'         => $result->discountCents,
            'discounted_total_cents' => $result->discountedTotalCents,
        ]);
    }
}
