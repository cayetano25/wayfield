<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Exceptions\AddonSessionEligibilityException;
use App\Domain\Payments\Exceptions\CartExpiredException;
use App\Domain\Payments\Exceptions\CartOrgMismatchException;
use App\Domain\Payments\Exceptions\DuplicateWorkshopInCartException;
use App\Domain\Payments\Exceptions\WorkshopNotPublishedException;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\SessionPricing;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;

class CartService
{
    private const CART_TTL_HOURS = 24;

    public function __construct(
        private readonly FeeCalculationService $feeCalculationService,
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

        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        $isDeposit         = false;
        $unitPriceCents    = 0;
        $depositAmtCents   = null;
        $balanceAmtCents   = null;
        $balanceDueDate    = null;

        if ($pricing !== null) {
            if ($pricing->deposit_enabled && $pricing->deposit_amount_cents > 0) {
                $isDeposit       = true;
                $unitPriceCents  = $pricing->deposit_amount_cents;
                $depositAmtCents = $pricing->deposit_amount_cents;
                $balanceAmtCents = $pricing->base_price_cents - $pricing->deposit_amount_cents;
                $balanceDueDate  = $pricing->balance_due_date;
            } else {
                $unitPriceCents = $pricing->base_price_cents;
            }
        }

        $item = CartItem::create([
            'cart_id'             => $cart->id,
            'item_type'           => 'workshop_registration',
            'workshop_id'         => $workshop->id,
            'unit_price_cents'    => $unitPriceCents,
            'quantity'            => 1,
            'line_total_cents'    => $unitPriceCents,
            'is_deposit'          => $isDeposit,
            'deposit_amount_cents' => $depositAmtCents,
            'balance_amount_cents' => $balanceAmtCents,
            'balance_due_date'    => $balanceDueDate,
            'currency'            => $cart->currency,
        ]);

        $this->recalculateSubtotal($cart);

        return $item;
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

        $item->delete();

        $this->recalculateSubtotal($cart);
    }

    /**
     * Return the cart with its items and fee breakdown for display.
     */
    public function getCartSummary(Cart $cart): array
    {
        $cart->load('items.workshop', 'items.session', 'organization');

        $planCode = $cart->organization->activeSubscription?->plan_code ?? 'foundation';
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
        $subtotal = CartItem::query()
            ->where('cart_id', $cart->id)
            ->sum('line_total_cents');

        $cart->update([
            'subtotal_cents'   => (int) $subtotal,
            'last_activity_at' => now(),
        ]);
    }
}
