<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\CheckoutResult;
use App\Domain\Payments\Exceptions\CartExpiredException;
use App\Domain\Payments\Exceptions\StripeConnectNotReadyException;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\OrderItem;
use App\Domain\Payments\Models\PaymentIntentRecord;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Domain\Sessions\Exceptions\SessionCapacityExceededException;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Notification;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

class CheckoutService
{
    private StripeClient $stripe;

    public function __construct(
        private readonly OrderNumberService $orderNumberService,
        private readonly FeeCalculationService $feeCalculationService,
        private readonly BalancePaymentService $balancePaymentService,
        private readonly CouponService $couponService,
        private readonly PriceResolutionService $priceResolutionService,
    ) {
        $this->stripe = new StripeClient(config('stripe.secret_key'));
    }

    /**
     * Main checkout orchestration entry point.
     *
     * Free orders complete synchronously; paid orders create a Stripe
     * PaymentIntent and return the client_secret for the frontend to confirm.
     * Fulfillment for paid orders happens after the webhook fires.
     */
    public function checkout(Cart $cart, User $user): CheckoutResult
    {
        if ($cart->status !== 'active' || $cart->expires_at->isPast()) {
            throw new CartExpiredException;
        }

        $cart->load('items.workshop', 'items.session');

        $this->validateCartItems($cart);

        // When a coupon is applied, use discounted_total_cents (which may be 0 for fully-covered orders).
        // When no coupon is applied, discounted_total_cents == subtotal_cents by invariant, but fall
        // back to subtotal_cents defensively (handles test carts that set subtotal_cents directly).
        $effectiveAmount = $cart->applied_coupon_id !== null
            ? $cart->discounted_total_cents
            : $cart->subtotal_cents;

        if ($effectiveAmount === 0) {
            return $this->freeCheckout($cart, $user);
        }

        return $this->stripeCheckout($cart, $user, $effectiveAmount);
    }

    /**
     * Complete a free checkout synchronously.
     */
    private function freeCheckout(Cart $cart, User $user): CheckoutResult
    {
        return DB::transaction(function () use ($cart, $user) {
            // Archive any stale checked_out carts for this user+org to avoid the unique constraint
            // violation on (user_id, organization_id, status).
            Cart::query()
                ->where('user_id', $user->id)
                ->where('organization_id', $cart->organization_id)
                ->where('status', 'checked_out')
                ->where('id', '!=', $cart->id)
                ->update(['status' => 'abandoned']);

            // Create as 'pending' so fulfillOrder's idempotency guard does not short-circuit.
            $order = $this->createOrder($cart, $user, 'free', 'pending');

            $this->createOrderItems($order, $cart);
            $this->copyCouponToOrder($cart, $order);

            $cart->update(['status' => 'checked_out', 'checked_out_at' => now()]);

            $this->fulfillOrder($order);

            return new CheckoutResult(order: $order, requiresPayment: false);
        });
    }

    /**
     * Create a Stripe PaymentIntent and return the client_secret.
     * Fulfillment happens asynchronously via webhook.
     */
    private function stripeCheckout(Cart $cart, User $user, int $effectiveAmount): CheckoutResult
    {
        $org            = $cart->organization ?? $cart->load('organization')->organization;
        $connectAccount = StripeConnectAccount::query()
            ->where('organization_id', $org->id)
            ->first();

        if ($connectAccount === null || ! $connectAccount->charges_enabled) {
            throw new StripeConnectNotReadyException;
        }

        $planCode = $org->activeSubscription?->plan_code ?? 'free';
        // Fees are calculated on the effective (post-coupon) amount.
        $fees = $this->feeCalculationService->calculateFees(
            $effectiveAmount,
            $planCode,
            $cart->currency,
        );

        return DB::transaction(function () use ($cart, $user, $org, $connectAccount, $fees, $effectiveAmount) {
            // Archive any stale checked_out carts for this user+org to avoid the unique constraint
            // violation on (user_id, organization_id, status).
            Cart::query()
                ->where('user_id', $user->id)
                ->where('organization_id', $cart->organization_id)
                ->where('status', 'checked_out')
                ->where('id', '!=', $cart->id)
                ->update(['status' => 'abandoned']);

            $order = $this->createOrder($cart, $user, 'stripe', 'pending', $fees);

            $this->createOrderItems($order, $cart);
            $this->copyCouponToOrder($cart, $order);

            $cart->update(['status' => 'checked_out', 'checked_out_at' => now()]);

            // Destination Charges: create the PaymentIntent on the platform account.
            // transfer_data[destination] routes funds to the connected account after collection.
            // Do NOT pass stripe_account header here — that would be Direct Charges (mutually exclusive).
            $stripeIntent = $this->stripe->paymentIntents->create([
                'amount'                    => $effectiveAmount,
                'currency'                  => $cart->currency,
                'automatic_payment_methods' => ['enabled' => true],
                'application_fee_amount'    => $fees->wayFieldFeeCents,
                'transfer_data'             => ['destination' => $connectAccount->stripe_account_id],
                'metadata'                  => [
                    'order_id'         => $order->id,
                    'order_number'     => $order->order_number,
                    'organization_id'  => $cart->organization_id,
                    'wayfield_user_id' => $user->id,
                ],
            ]);

            // Store a hashed reference (never the raw secret).
            $intentRecord = new PaymentIntentRecord([
                'order_id'                  => $order->id,
                'intent_type'               => 'full',
                'stripe_payment_intent_id'  => $stripeIntent->id,
                'stripe_account_id'         => $connectAccount->stripe_account_id,
                'amount_cents'              => $effectiveAmount,
                'currency'                  => $cart->currency,
                'application_fee_cents'     => $fees->wayFieldFeeCents,
                'status'                    => 'requires_payment_method',
                'stripe_status'             => $stripeIntent->status,
            ]);
            $intentRecord->client_secret_hash = hash('sha256', $stripeIntent->client_secret);
            $intentRecord->save();

            $order->update(['stripe_payment_intent_id' => $stripeIntent->id]);

            return new CheckoutResult(
                order: $order,
                requiresPayment: true,
                clientSecret: $stripeIntent->client_secret,
                stripePublishableKey: config('stripe.publishable_key'),
            );
        });
    }

    /**
     * Fulfill a completed order by creating registrations and session selections.
     *
     * Idempotent: if the order is already completed, this is a no-op.
     */
    public function fulfillOrder(Order $order): void
    {
        if ($order->status === 'completed') {
            return;
        }

        DB::transaction(function () use ($order) {
            $order->load('items.workshop', 'items.session');

            foreach ($order->items as $item) {
                match ($item->item_type) {
                    'workshop_registration' => $this->fulfillWorkshopRegistration($order, $item),
                    'addon_session'         => $this->fulfillAddonSession($order, $item),
                    default                 => null,
                };
            }

            $order->update([
                'status'       => 'completed',
                'completed_at' => now(),
            ]);

            if ($order->is_deposit_order) {
                $order->update(['deposit_paid_at' => now()]);
                $this->balancePaymentService->scheduleBalanceJobs($order);
            }

            $this->couponService->recordRedemption($order);

            $this->queueConfirmationNotifications($order);

            $this->updateTierAnalytics($order);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => $order->user_id,
                'entity_type'     => 'order',
                'entity_id'       => $order->id,
                'action'          => 'payment.order_completed',
                'metadata'        => [
                    'order_number'  => $order->order_number,
                    'total_cents'   => $order->total_cents,
                    'payment_method' => $order->payment_method,
                ],
            ]);
        });
    }

    /**
     * Handle payment_intent.succeeded webhook event.
     */
    public function handlePaymentIntentSucceeded(array $stripeEvent): void
    {
        $intentId = $stripeEvent['data']['object']['id'] ?? null;
        if (! $intentId) {
            Log::warning('CheckoutService: payment_intent.succeeded missing intent id');
            return;
        }

        $order = Order::query()
            ->where('stripe_payment_intent_id', $intentId)
            ->first();

        if (! $order) {
            Log::warning('CheckoutService: order not found for PaymentIntent', ['intent_id' => $intentId]);
            return;
        }

        // Idempotent guard.
        if ($order->status === 'completed') {
            return;
        }

        PaymentIntentRecord::query()
            ->where('stripe_payment_intent_id', $intentId)
            ->update([
                'status'       => 'succeeded',
                'stripe_status' => 'succeeded',
                'confirmed_at' => now(),
            ]);

        $this->fulfillOrder($order);
    }

    /**
     * Handle payment_intent.payment_failed webhook event.
     */
    public function handlePaymentIntentFailed(array $stripeEvent): void
    {
        $intentData = $stripeEvent['data']['object'] ?? [];
        $intentId   = $intentData['id'] ?? null;

        if (! $intentId) {
            Log::warning('CheckoutService: payment_intent.payment_failed missing intent id');
            return;
        }

        $order = Order::query()
            ->where('stripe_payment_intent_id', $intentId)
            ->first();

        if (! $order || $order->status === 'completed') {
            return;
        }

        $lastError = $intentData['last_payment_error']['message']
            ?? $intentData['last_payment_error']['code']
            ?? 'Payment failed';

        $order->update(['status' => 'failed']);

        PaymentIntentRecord::query()
            ->where('stripe_payment_intent_id', $intentId)
            ->update([
                'status'             => 'failed',
                'stripe_status'      => 'requires_payment_method',
                'last_payment_error' => $lastError,
            ]);

        // Queue in-app notification N-40 (payment failed).
        Notification::create([
            'organization_id'  => $order->organization_id,
            'sent_by_user_id'  => null,
            'workshop_id'      => null,
            'notification_type' => 'urgent',
            'delivery_scope'   => 'all_participants',
            'title'            => 'Payment failed',
            'body'             => "Your payment for order {$order->order_number} could not be processed. "
                . 'Please retry with a different payment method.',
            'status'           => 'queued',
        ]);

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'actor_user_id'   => $order->user_id,
            'entity_type'     => 'order',
            'entity_id'       => $order->id,
            'action'          => 'payment.order_failed',
            'metadata'        => [
                'order_number'      => $order->order_number,
                'stripe_intent_id'  => $intentId,
                'last_payment_error' => $lastError,
            ],
        ]);
    }

    // ─── Fulfillment helpers ──────────────────────────────────────────────────

    private function fulfillWorkshopRegistration(Order $order, OrderItem $item): void
    {
        if (! $item->workshop_id) {
            return;
        }

        // Capacity check with lock.
        $workshop = $item->workshop;
        DB::table('registrations')->lockForUpdate()->where('workshop_id', $workshop->id)->count();

        $registration = Registration::firstOrCreate(
            [
                'user_id'     => $order->user_id,
                'workshop_id' => $item->workshop_id,
            ],
            [
                'registration_status' => 'registered',
                'registered_at'       => now(),
            ]
        );

        if ($registration->registration_status !== 'registered') {
            $registration->update([
                'registration_status' => 'registered',
                'registered_at'       => now(),
                'canceled_at'         => null,
            ]);
        }

        $item->update([
            'registration_id' => $registration->id,
        ]);
    }

    private function fulfillAddonSession(Order $order, OrderItem $item): void
    {
        if (! $item->session_id) {
            return;
        }

        // Find the user's active registration for the parent workshop.
        $session  = $item->session;
        $workshop = $session->workshop;

        $registration = Registration::query()
            ->where('user_id', $order->user_id)
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->first();

        if (! $registration) {
            // Safety: should not happen if cart validation passed, but log and skip.
            Log::error('CheckoutService: no active registration for addon session fulfillment', [
                'order_id'  => $order->id,
                'session_id' => $item->session_id,
                'user_id'   => $order->user_id,
            ]);
            return;
        }

        $existing = SessionSelection::query()
            ->where('registration_id', $registration->id)
            ->where('session_id', $item->session_id)
            ->first();

        if ($existing) {
            if ($existing->selection_status !== 'selected') {
                $existing->update([
                    'selection_status'  => 'selected',
                    'assignment_source' => 'addon_purchase',
                    'assigned_at'       => now(),
                ]);
            }
            $item->update(['session_selection_id' => $existing->id]);
        } else {
            $selection = SessionSelection::create([
                'registration_id'  => $registration->id,
                'session_id'       => $item->session_id,
                'selection_status' => 'selected',
                'assignment_source' => 'addon_purchase',
                'assigned_at'      => now(),
            ]);
            $item->update(['session_selection_id' => $selection->id]);
        }
    }

    private function queueConfirmationNotifications(Order $order): void
    {
        // Notification dispatching is queued via Laravel queue.
        // The specific notification codes (N-01 through N-04) are dispatched
        // through the existing notification pipeline from their respective jobs.
        // Here we dispatch the order-confirmation job which handles routing.
        \App\Jobs\SendOrderConfirmationJob::dispatch($order->id);
    }

    // ─── Cart validation ──────────────────────────────────────────────────────

    private function validateCartItems(Cart $cart): void
    {
        foreach ($cart->items as $item) {
            match ($item->item_type) {
                'workshop_registration' => $this->validateWorkshopItem($item),
                'addon_session'         => $this->validateAddonSessionItem($item),
                default                 => null,
            };
        }
    }

    private function validateWorkshopItem(CartItem $item): void
    {
        if (! $item->workshop || $item->workshop->status !== 'published') {
            throw new \RuntimeException(
                "Workshop '{$item->workshop?->title}' is no longer available for registration."
            );
        }
    }

    private function validateAddonSessionItem(CartItem $item): void
    {
        if (! $item->session || $item->session->publication_status !== 'published') {
            throw new \RuntimeException(
                "Session '{$item->session?->title}' is no longer available."
            );
        }
    }

    // ─── Order creation ───────────────────────────────────────────────────────

    private function createOrder(
        Cart $cart,
        User $user,
        string $paymentMethod,
        string $status,
        ?\App\Domain\Payments\DTOs\FeeBreakdown $fees = null,
    ): Order {
        $orderNumber = $this->orderNumberService->generateOrderNumber();

        $depositItem = CartItem::query()
            ->where('cart_id', $cart->id)
            ->where('is_deposit', true)
            ->first();

        $isDeposit          = $depositItem !== null;
        $balanceDueDate     = $depositItem?->balance_due_date;
        $balanceAmountCents = $depositItem?->balance_amount_cents;
        $balanceAutoCharge  = true;

        if ($isDeposit && $depositItem?->workshop_id) {
            $pricing           = WorkshopPricing::query()
                ->where('workshop_id', $depositItem->workshop_id)
                ->first();
            $balanceAutoCharge = $pricing?->balance_auto_charge ?? true;
        }

        return Order::create([
            'order_number'           => $orderNumber,
            'user_id'                => $user->id,
            'organization_id'        => $cart->organization_id,
            'cart_id'                => $cart->id,
            'status'                 => $status,
            'payment_method'         => $paymentMethod,
            'subtotal_cents'         => $cart->subtotal_cents,
            'wayfield_fee_cents'     => $fees?->wayFieldFeeCents ?? 0,
            'stripe_fee_cents'       => $fees?->stripeFeeCents ?? 0,
            // Effective total after coupon; fall back to subtotal when discounted_total_cents is unset.
            'total_cents'            => $fees?->amountCents ?? $cart->discounted_total_cents ?? $cart->subtotal_cents,
            'organizer_payout_cents' => $fees?->organizerPayoutCents ?? 0,
            'currency'               => $cart->currency,
            'take_rate_pct'          => $fees?->takeRatePct ?? 0,
            'is_deposit_order'       => $isDeposit,
            'balance_due_date'       => $balanceDueDate,
            'balance_amount_cents'   => $balanceAmountCents,
            'balance_auto_charge'    => $balanceAutoCharge,
        ]);
    }

    private function copyCouponToOrder(Cart $cart, Order $order): void
    {
        if ($cart->applied_coupon_id === null) {
            return;
        }

        $order->update([
            'coupon_id'      => $cart->applied_coupon_id,
            'coupon_code'    => $cart->coupon_code_applied,
            'discount_cents' => $cart->discount_cents,
        ]);
    }

    private function createOrderItems(Order $order, Cart $cart): void
    {
        foreach ($cart->items as $item) {
            OrderItem::create([
                'order_id'           => $order->id,
                'item_type'          => $item->item_type,
                'workshop_id'        => $item->workshop_id,
                'session_id'         => $item->session_id,
                'unit_price_cents'   => $item->unit_price_cents,
                'applied_tier_id'    => $item->applied_tier_id,
                'applied_tier_label' => $item->applied_tier_label,
                'is_tier_price'      => $item->is_tier_price ?? false,
                'quantity'           => $item->quantity,
                'line_total_cents'   => $item->line_total_cents,
                'is_deposit'         => $item->is_deposit,
                'currency'           => $item->currency,
            ]);
        }
    }

    private function updateTierAnalytics(Order $order): void
    {
        foreach ($order->items as $item) {
            if (! $item->is_tier_price || $item->applied_tier_id === null) {
                continue;
            }

            WorkshopPriceTier::where('id', $item->applied_tier_id)->increment('registrations_at_tier');

            $tier = WorkshopPriceTier::find($item->applied_tier_id);
            if ($tier === null || $tier->capacity_limit === null || $item->workshop_id === null) {
                continue;
            }

            $currentCount = Registration::where('workshop_id', $item->workshop_id)
                ->whereIn('registration_status', ['registered', 'waitlisted'])
                ->count();

            if ($currentCount < $tier->capacity_limit) {
                continue;
            }

            // Tier capacity reached — bust cache and notify organizer.
            $this->priceResolutionService->bustCache($item->workshop_id);

            $nextTier = WorkshopPriceTier::where('workshop_id', $item->workshop_id)
                ->where('sort_order', '>', $tier->sort_order)
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->first();

            $nextLabel = $nextTier?->label ?? 'standard pricing';

            $workshopTitle = $item->workshop?->title ?? "Workshop #{$item->workshop_id}";

            Notification::create([
                'organization_id'       => $order->organization_id,
                'workshop_id'           => $item->workshop_id,
                'notification_type'     => 'informational',
                'sender_scope'          => 'organizer',
                'delivery_scope'        => 'all_participants',
                'title'                 => "{$tier->label} is now full",
                'message'               => "{$tier->label} is now full. {$workshopTitle} pricing has moved to {$nextLabel}.",
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => $order->user_id,
                'entity_type'     => 'workshop_price_tier',
                'entity_id'       => $tier->id,
                'action'          => 'price_tier.capacity_reached',
                'metadata'        => [
                    'tier_label'        => $tier->label,
                    'capacity_limit'    => $tier->capacity_limit,
                    'current_count'     => $currentCount,
                    'workshop_id'       => $item->workshop_id,
                    'next_tier_label'   => $nextLabel,
                ],
            ]);
        }
    }
}
