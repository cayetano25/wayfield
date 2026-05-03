<?php

declare(strict_types=1);

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\OrderItem;
use App\Domain\Payments\Models\PaymentIntentRecord;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Registration;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\CardException;
use Stripe\StripeClient;

class BalancePaymentService
{
    /** Positional notification codes for balance reminder emails. */
    private const REMINDER_CODES = ['N-56', 'N-57', 'N-58'];

    public function __construct(
        private readonly FeeCalculationService $feeCalculationService,
    ) {}

    /**
     * Create ScheduledPaymentJob rows for balance reminders and auto-charge.
     * Called from CheckoutService::fulfillOrder() when is_deposit_order = true.
     */
    public function scheduleBalanceJobs(Order $order): void
    {
        if (! $order->is_deposit_order || ! $order->balance_due_date) {
            return;
        }

        $reminderDays = $this->resolveReminderDays($order);

        foreach ($reminderDays as $index => $days) {
            $scheduledFor = Carbon::parse($order->balance_due_date)
                ->subDays($days)
                ->setTime(9, 0, 0);

            if ($scheduledFor->isFuture()) {
                ScheduledPaymentJob::create([
                    'job_type'            => 'balance_reminder',
                    'notification_code'   => self::REMINDER_CODES[$index] ?? null,
                    'related_entity_type' => 'order',
                    'related_entity_id'   => $order->id,
                    'user_id'             => $order->user_id,
                    'scheduled_for'       => $scheduledFor,
                    'status'              => 'pending',
                    'max_attempts'        => 3,
                ]);
            }
        }

        // Auto-charge job fires at midnight UTC on the due date.
        $chargeAt = Carbon::parse($order->balance_due_date)->startOfDay();

        if ($chargeAt->isFuture()) {
            ScheduledPaymentJob::create([
                'job_type'            => 'balance_charge',
                'related_entity_type' => 'order',
                'related_entity_id'   => $order->id,
                'user_id'             => $order->user_id,
                'scheduled_for'       => $chargeAt,
                'status'              => 'pending',
                'max_attempts'        => 3,
            ]);
        }
    }

    /**
     * Attempt to charge the outstanding balance off-session using the
     * payment method from the original deposit PaymentIntent.
     *
     * Called by ProcessBalanceChargeJob when job_type = 'balance_charge'.
     */
    public function processAutoBalanceCharge(Order $order): void
    {
        // Idempotency guard.
        if ($order->balance_paid_at !== null) {
            return;
        }

        // Deposit must have been fulfilled first.
        if ($order->status !== 'completed') {
            Log::warning('BalancePaymentService: order not completed, skipping balance charge', [
                'order_id' => $order->id,
                'status'   => $order->status,
            ]);
            return;
        }

        $connectAccount = StripeConnectAccount::query()
            ->where('organization_id', $order->organization_id)
            ->first();

        if (! $connectAccount || ! $connectAccount->charges_enabled) {
            Log::error('BalancePaymentService: Stripe Connect not ready for balance charge', [
                'order_id'        => $order->id,
                'organization_id' => $order->organization_id,
            ]);
            return;
        }

        $stripeAccountId = $connectAccount->stripe_account_id;
        $stripe          = new StripeClient(config('stripe.secret_key'));

        // Retrieve the deposit PaymentIntent to find the saved payment method.
        // Destination Charges: intent lives on the platform account — no stripe_account header.
        $depositIntent   = $stripe->paymentIntents->retrieve(
            $order->stripe_payment_intent_id,
        );
        $paymentMethodId = $depositIntent->payment_method;

        $org      = $order->organization;
        $planCode = $org->activeSubscription?->plan_code ?? 'foundation';
        $fees     = $this->feeCalculationService->calculateFees(
            (int) $order->balance_amount_cents,
            $planCode,
            $order->currency,
        );

        try {
            $balanceIntent = $stripe->paymentIntents->create([
                'amount'                 => (int) $order->balance_amount_cents,
                'currency'               => $order->currency,
                'payment_method'         => $paymentMethodId,
                'confirm'                => true,
                'application_fee_amount' => $fees->wayFieldFeeCents,
                'transfer_data'          => ['destination' => $stripeAccountId],
                'off_session'            => true,
                'metadata'               => [
                    'order_id'     => $order->id,
                    'intent_type'  => 'balance',
                    'order_number' => $order->order_number,
                ],
            ]);

            DB::transaction(function () use ($order, $balanceIntent, $fees, $stripeAccountId) {
                $order->update([
                    'balance_paid_at'                  => now(),
                    'balance_stripe_payment_intent_id' => $balanceIntent->id,
                ]);

                PaymentIntentRecord::create([
                    'order_id'                 => $order->id,
                    'intent_type'              => 'balance',
                    'stripe_payment_intent_id' => $balanceIntent->id,
                    'stripe_account_id'        => $stripeAccountId,
                    'amount_cents'             => (int) $order->balance_amount_cents,
                    'currency'                 => $order->currency,
                    'application_fee_cents'    => $fees->wayFieldFeeCents,
                    'status'                   => 'succeeded',
                    'stripe_status'            => $balanceIntent->status,
                    'confirmed_at'             => now(),
                ]);

                AuditLogService::record([
                    'organization_id' => $order->organization_id,
                    'actor_user_id'   => null,
                    'entity_type'     => 'order',
                    'entity_id'       => $order->id,
                    'action'          => 'payment.balance_charged',
                    'metadata'        => [
                        'order_number'         => $order->order_number,
                        'balance_amount_cents'  => $order->balance_amount_cents,
                        'stripe_intent_id'     => $balanceIntent->id,
                    ],
                ]);
            });

            // Notify participant (N-59) and organizer in-app (N-60).
            \App\Jobs\SendBalanceChargedNotificationJob::dispatch($order->id);

        } catch (CardException $e) {
            $this->handleChargeFailure($order, $e->getMessage());
        }
    }

    /**
     * Prepare a Stripe PaymentIntent for the balance payment web page.
     *
     * Reuses an existing pending balance PaymentIntent when one exists;
     * otherwise creates a new one. Does NOT send an email — that is the
     * responsibility of the scheduled reminder job (SendBalancePaymentLinkJob).
     *
     * Returns the client_secret and publishable key for Stripe Elements.
     */
    public function prepareBalanceIntent(Order $order): array
    {
        $connectAccount = StripeConnectAccount::query()
            ->where('organization_id', $order->organization_id)
            ->first();

        if (! $connectAccount || ! $connectAccount->charges_enabled) {
            throw new \RuntimeException('Stripe Connect not ready for this organization.');
        }

        $stripeAccountId = $connectAccount->stripe_account_id;
        $stripe          = new StripeClient(config('stripe.secret_key'));

        // Try to reuse an existing pending intent so the participant doesn't get
        // duplicate payment records on repeated page loads.
        $existing = PaymentIntentRecord::query()
            ->where('order_id', $order->id)
            ->where('intent_type', 'balance')
            ->whereNotIn('status', ['succeeded', 'cancelled'])
            ->latest()
            ->first();

        if ($existing) {
            $stripeIntent = $stripe->paymentIntents->retrieve(
                $existing->stripe_payment_intent_id,
            );

            if (in_array($stripeIntent->status, ['requires_payment_method', 'requires_confirmation', 'requires_action'], true)) {
                return [
                    'client_secret'          => $stripeIntent->client_secret,
                    'stripe_publishable_key' => config('stripe.publishable_key'),
                    'amount_cents'           => (int) $order->balance_amount_cents,
                ];
            }
        }

        $org      = $order->organization;
        $planCode = $org->activeSubscription?->plan_code ?? 'foundation';
        $fees     = $this->feeCalculationService->calculateFees(
            (int) $order->balance_amount_cents,
            $planCode,
            $order->currency,
        );

        $intent = $stripe->paymentIntents->create([
            'amount'                    => (int) $order->balance_amount_cents,
            'currency'                  => $order->currency,
            'automatic_payment_methods' => ['enabled' => true],
            'application_fee_amount'    => $fees->wayFieldFeeCents,
            'transfer_data'             => ['destination' => $stripeAccountId],
            'metadata'                  => [
                'order_id'     => $order->id,
                'intent_type'  => 'balance',
                'order_number' => $order->order_number,
            ],
        ]);

        PaymentIntentRecord::create([
            'order_id'                 => $order->id,
            'intent_type'              => 'balance',
            'stripe_payment_intent_id' => $intent->id,
            'stripe_account_id'        => $stripeAccountId,
            'amount_cents'             => (int) $order->balance_amount_cents,
            'currency'                 => $order->currency,
            'application_fee_cents'    => $fees->wayFieldFeeCents,
            'status'                   => 'requires_payment_method',
            'stripe_status'            => $intent->status,
        ]);

        return [
            'client_secret'          => $intent->client_secret,
            'stripe_publishable_key' => config('stripe.publishable_key'),
            'amount_cents'           => (int) $order->balance_amount_cents,
        ];
    }

    /**
     * Create a Stripe PaymentIntent (requires_payment_method) for the
     * participant to complete their balance payment manually.
     *
     * Returns the Wayfield-internal URL to the balance payment page.
     * Called when job_type = 'balance_reminder' fires and balance_auto_charge = false,
     * or from the GET balance-payment-intent endpoint.
     */
    public function createBalancePaymentLink(Order $order): string
    {
        $connectAccount = StripeConnectAccount::query()
            ->where('organization_id', $order->organization_id)
            ->first();

        if (! $connectAccount || ! $connectAccount->charges_enabled) {
            throw new \RuntimeException('Stripe Connect not ready for this organization.');
        }

        $stripeAccountId = $connectAccount->stripe_account_id;
        $stripe          = new StripeClient(config('stripe.secret_key'));

        $org      = $order->organization;
        $planCode = $org->activeSubscription?->plan_code ?? 'foundation';
        $fees     = $this->feeCalculationService->calculateFees(
            (int) $order->balance_amount_cents,
            $planCode,
            $order->currency,
        );

        $intent = $stripe->paymentIntents->create([
            'amount'                    => (int) $order->balance_amount_cents,
            'currency'                  => $order->currency,
            'automatic_payment_methods' => ['enabled' => true],
            'application_fee_amount'    => $fees->wayFieldFeeCents,
            'transfer_data'             => ['destination' => $stripeAccountId],
            'metadata'                  => [
                'order_id'     => $order->id,
                'intent_type'  => 'balance',
                'order_number' => $order->order_number,
            ],
        ]);

        PaymentIntentRecord::create([
            'order_id'                 => $order->id,
            'intent_type'              => 'balance',
            'stripe_payment_intent_id' => $intent->id,
            'stripe_account_id'        => $stripeAccountId,
            'amount_cents'             => (int) $order->balance_amount_cents,
            'currency'                 => $order->currency,
            'application_fee_cents'    => $fees->wayFieldFeeCents,
            'status'                   => 'requires_payment_method',
            'stripe_status'            => $intent->status,
        ]);

        // Queue N-61 email with the payment link.
        \App\Jobs\SendBalancePaymentLinkJob::dispatch($order->id, $intent->client_secret);

        return url("/balance-payment/{$order->order_number}");
    }

    /**
     * Called 72 hours after a failed balance charge if balance_paid_at is still null.
     * Cancels the registration and forfeits the deposit.
     */
    public function handleBalancePaymentExpiry(Order $order): void
    {
        if ($order->balance_paid_at !== null) {
            // Paid during the grace period — cancel remaining jobs only.
            ScheduledPaymentJob::query()
                ->forEntity('order', $order->id)
                ->where('status', 'pending')
                ->get()
                ->each(fn ($job) => $job->cancel('balance_paid_in_grace_period'));
            return;
        }

        DB::transaction(function () use ($order) {
            // Cancel all pending scheduled jobs for this order.
            ScheduledPaymentJob::query()
                ->forEntity('order', $order->id)
                ->where('status', 'pending')
                ->get()
                ->each(fn ($job) => $job->cancel('balance_expired'));

            // Cancel the registrations linked to this order's items.
            $registrationIds = OrderItem::query()
                ->where('order_id', $order->id)
                ->where('item_type', 'workshop_registration')
                ->whereNotNull('registration_id')
                ->pluck('registration_id');

            if ($registrationIds->isNotEmpty()) {
                Registration::query()
                    ->whereIn('id', $registrationIds)
                    ->update([
                        'registration_status' => 'cancelled',
                        'canceled_at'         => now(),
                    ]);
            }

            $order->update([
                'status'               => 'cancelled',
                'cancelled_at'         => now(),
                'cancellation_reason'  => 'balance_not_paid',
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'order',
                'entity_id'       => $order->id,
                'action'          => 'payment.balance_expired',
                'metadata'        => [
                    'order_number'        => $order->order_number,
                    'balance_amount_cents' => $order->balance_amount_cents,
                ],
            ]);
        });

        // Notify participant (N-65) and organizer in-app (N-66).
        \App\Jobs\SendBalanceExpiredNotificationJob::dispatch($order->id);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function handleChargeFailure(Order $order, string $errorMessage): void
    {
        DB::transaction(function () use ($order, $errorMessage) {
            $order->update(['status' => 'balance_payment_failed']);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'order',
                'entity_id'       => $order->id,
                'action'          => 'payment.balance_charge_failed',
                'metadata'        => [
                    'order_number'  => $order->order_number,
                    'error_message' => $errorMessage,
                ],
            ]);
        });

        // Notify participant (N-62) and organizer (N-63).
        \App\Jobs\SendBalanceFailedNotificationJob::dispatch($order->id);

        // Schedule 72-hour expiry.
        ScheduledPaymentJob::create([
            'job_type'            => 'balance_payment_expiry',
            'related_entity_type' => 'order',
            'related_entity_id'   => $order->id,
            'user_id'             => $order->user_id,
            'scheduled_for'       => now()->addHours(72),
            'status'              => 'pending',
            'max_attempts'        => 3,
        ]);
    }

    /** Pull balance_reminder_days from workshop pricing linked to this order. */
    private function resolveReminderDays(Order $order): array
    {
        $workshopId = $order->items()
            ->where('item_type', 'workshop_registration')
            ->value('workshop_id');

        if (! $workshopId) {
            return [30, 7, 2];
        }

        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshopId)
            ->first();

        return $pricing?->balance_reminder_days ?? [30, 7, 2];
    }
}
