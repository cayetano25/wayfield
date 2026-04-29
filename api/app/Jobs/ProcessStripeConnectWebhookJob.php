<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\PaymentIntentRecord;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Models\Notification;
use App\Domain\Payments\Services\CheckoutService;
use App\Domain\Payments\Services\DisputeService;
use App\Domain\Payments\Services\RefundService;
use App\Domain\Payments\Services\StripeConnectService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\StripeEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessStripeConnectWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $stripeEventId,
    ) {}

    public function handle(
        StripeConnectService $service,
        CheckoutService $checkoutService,
        RefundService $refundService,
        DisputeService $disputeService,
    ): void
    {
        $record = StripeEvent::find($this->stripeEventId);

        if (! $record) {
            Log::warning('ProcessStripeConnectWebhookJob: StripeEvent not found', [
                'stripe_event_id' => $this->stripeEventId,
            ]);
            return;
        }

        if ($record->isProcessed()) {
            return;
        }

        $payload = $record->payload_json;
        $type    = $record->event_type;

        try {
            match (true) {
                $type === 'account.updated'
                    => $service->handleAccountUpdatedWebhook($payload),

                $type === 'account.application.deauthorized'
                    => $service->handleAccountDeauthorizedWebhook($payload),

                $type === 'payout.paid'
                    => $this->handlePayoutPaid($payload),

                $type === 'payout.failed'
                    => $service->handlePayoutFailedWebhook($payload),

                $type === 'capability.updated'
                    => $service->handleCapabilityUpdatedWebhook($payload),

                $type === 'payment_intent.succeeded'
                    => $checkoutService->handlePaymentIntentSucceeded($payload),

                $type === 'payment_intent.payment_failed'
                    => $checkoutService->handlePaymentIntentFailed($payload),

                $type === 'payment_intent.processing'
                    => $this->handlePaymentIntentProcessing($payload),

                $type === 'payment_intent.canceled'
                    => $this->handlePaymentIntentCanceled($payload),

                $type === 'payment_intent.requires_action'
                    => $this->handlePaymentIntentRequiresAction($payload),

                $type === 'charge.refund.updated'
                    => $refundService->handleRefundUpdated($payload),

                $type === 'charge.dispute.created'
                    => $disputeService->handleDisputeCreated($payload),

                $type === 'charge.dispute.updated'
                    => $disputeService->handleDisputeUpdated($payload),

                $type === 'charge.dispute.closed'
                    => $disputeService->handleDisputeClosed($payload),

                str_starts_with($type, 'payment_intent.')
                    => Log::info('ProcessStripeConnectWebhookJob: unhandled payment_intent event', [
                        'type' => $type,
                        'event_id' => $payload['id'] ?? null,
                    ]),

                default => Log::info('ProcessStripeConnectWebhookJob: unhandled event type', [
                    'type' => $type,
                ]),
            };

            $record->update(['processed_at' => now()]);
        } catch (\Throwable $e) {
            $record->update(['error_message' => $e->getMessage()]);

            Log::error('ProcessStripeConnectWebhookJob failed', [
                'stripe_event_db_id' => $this->stripeEventId,
                'type'               => $type,
                'error'              => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    private function handlePayoutPaid(array $payload): void
    {
        $payout          = $payload['data']['object'] ?? [];
        $stripeAccountId = $payload['account'] ?? null;

        $account = $stripeAccountId
            ? StripeConnectAccount::where('stripe_account_id', $stripeAccountId)->first()
            : null;

        AuditLogService::record([
            'organization_id' => $account?->organization_id,
            'entity_type'     => 'stripe_connect_account',
            'entity_id'       => $account?->id,
            'action'          => 'stripe_connect.payout_paid',
            'metadata'        => [
                'stripe_account_id' => $stripeAccountId,
                'payout_id'         => $payout['id'] ?? null,
                'amount_cents'      => $payout['amount'] ?? null,
                'currency'          => $payout['currency'] ?? null,
                'arrival_date'      => $payout['arrival_date'] ?? null,
            ],
        ]);

        if (! $account) {
            Log::warning('ProcessStripeConnectWebhookJob: payout.paid for unknown account', [
                'stripe_account_id' => $stripeAccountId,
            ]);
            return;
        }

        $amountFormatted = $payout['amount'] !== null
            ? '$' . number_format($payout['amount'] / 100, 2)
            : 'your payout';

        Notification::create([
            'organization_id'    => $account->organization_id,
            'workshop_id'        => null,
            'created_by_user_id' => null,
            'notification_type'  => 'informational',
            'sender_scope'       => 'organizer',
            'delivery_scope'     => 'all_participants',
            'title'              => 'Payout on its way',
            'message'            => "A payout of {$amountFormatted} ({$payout['currency']}) has been sent to your bank account and should arrive within 1–2 business days.",
        ]);

        Log::info('ProcessStripeConnectWebhookJob: payout.paid notification created', [
            'organization_id' => $account->organization_id,
            'payout_id'       => $payout['id'] ?? null,
            'amount_cents'    => $payout['amount'] ?? null,
        ]);
    }

    private function handlePaymentIntentRequiresAction(array $payload): void
    {
        $intent                = $payload['data']['object'] ?? [];
        $stripePaymentIntentId = $intent['id'] ?? null;
        $nextAction            = $intent['next_action'] ?? null;

        if (! $stripePaymentIntentId) {
            Log::warning('ProcessStripeConnectWebhookJob: payment_intent.requires_action missing ID');
            return;
        }

        $order = Order::where('stripe_payment_intent_id', $stripePaymentIntentId)->first();

        if (! $order) {
            Log::info('ProcessStripeConnectWebhookJob: payment_intent.requires_action — no matching order', [
                'stripe_payment_intent_id' => $stripePaymentIntentId,
            ]);
            return;
        }

        if (in_array($order->status, ['completed', 'cancelled', 'fully_refunded'], true)) {
            return;
        }

        PaymentIntentRecord::where('stripe_payment_intent_id', $stripePaymentIntentId)
            ->update(['status' => 'requires_action']);

        Log::info('ProcessStripeConnectWebhookJob: PaymentIntent requires action (3DS/SCA)', [
            'order_id'    => $order->id,
            'next_action' => $nextAction['type'] ?? 'unknown',
        ]);

        // In-app notification to participant: action required to complete payment.
        Notification::create([
            'organization_id'   => $order->organization_id,
            'workshop_id'       => null,
            'created_by_user_id' => null,
            'notification_type' => 'urgent',
            'sender_scope'      => 'organizer',
            'delivery_scope'    => 'all_participants',
            'title'             => 'Payment action required',
            'message'           => "Your bank requires you to verify payment for order {$order->order_number}. "
                                 . 'Please return to checkout to complete the process.',
        ]);

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'actor_user_id'   => null,
            'entity_type'     => 'order',
            'entity_id'       => $order->id,
            'action'          => 'payment.requires_action',
            'metadata'        => [
                'stripe_payment_intent_id' => $stripePaymentIntentId,
                'next_action_type'         => $nextAction['type'] ?? 'unknown',
            ],
        ]);

        // Schedule a 2-hour reminder if the participant has not completed authentication.
        ScheduledPaymentJob::create([
            'job_type'            => 'payment_requires_action_reminder',
            'related_entity_type' => 'order',
            'related_entity_id'   => $order->id,
            'user_id'             => $order->user_id,
            'scheduled_for'       => now()->addHours(2),
            'status'              => 'pending',
        ]);
    }

    private function handlePaymentIntentProcessing(array $payload): void
    {
        $stripePaymentIntentId = $payload['data']['object']['id'] ?? null;

        if (! $stripePaymentIntentId) {
            Log::warning('ProcessStripeConnectWebhookJob: payment_intent.processing missing payment intent ID');
            return;
        }

        $order = Order::where('stripe_payment_intent_id', $stripePaymentIntentId)->first();

        if (! $order) {
            Log::info('ProcessStripeConnectWebhookJob: payment_intent.processing — no matching order', [
                'stripe_payment_intent_id' => $stripePaymentIntentId,
            ]);
            return;
        }

        if ($order->status !== 'pending') {
            Log::info('ProcessStripeConnectWebhookJob: payment_intent.processing — order already past pending', [
                'order_id' => $order->id,
                'status'   => $order->status,
            ]);
            return;
        }

        $order->update(['status' => 'processing']);

        PaymentIntentRecord::where('stripe_payment_intent_id', $stripePaymentIntentId)
            ->update(['status' => 'processing']);

        Log::info('ProcessStripeConnectWebhookJob: order status updated to processing', [
            'order_id'     => $order->id,
            'order_number' => $order->order_number,
        ]);

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'entity_type'     => 'order',
            'entity_id'       => $order->id,
            'action'          => 'payment.order_processing',
            'metadata'        => ['stripe_payment_intent_id' => $stripePaymentIntentId],
        ]);
    }

    private function handlePaymentIntentCanceled(array $payload): void
    {
        $stripePaymentIntentId = $payload['data']['object']['id'] ?? null;
        $cancellationReason    = $payload['data']['object']['cancellation_reason'] ?? 'unknown';

        if (! $stripePaymentIntentId) {
            Log::warning('ProcessStripeConnectWebhookJob: payment_intent.canceled missing payment intent ID');
            return;
        }

        $order = Order::where('stripe_payment_intent_id', $stripePaymentIntentId)->first();

        if (! $order) {
            Log::info('ProcessStripeConnectWebhookJob: payment_intent.canceled — no matching order', [
                'stripe_payment_intent_id' => $stripePaymentIntentId,
            ]);
            return;
        }

        if (in_array($order->status, ['completed', 'cancelled', 'fully_refunded'], true)) {
            return;
        }

        $order->update([
            'status'              => 'cancelled',
            'cancelled_at'        => now(),
            'cancellation_reason' => "Stripe PaymentIntent canceled: {$cancellationReason}",
        ]);

        PaymentIntentRecord::where('stripe_payment_intent_id', $stripePaymentIntentId)
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);

        Log::info('ProcessStripeConnectWebhookJob: order cancelled due to payment intent cancellation', [
            'order_id'            => $order->id,
            'cancellation_reason' => $cancellationReason,
        ]);

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'entity_type'     => 'order',
            'entity_id'       => $order->id,
            'action'          => 'payment.order_cancelled',
            'metadata'        => [
                'stripe_payment_intent_id' => $stripePaymentIntentId,
                'cancellation_reason'      => $cancellationReason,
            ],
        ]);
    }
}
