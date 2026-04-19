<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Billing\Services\StripeService;
use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\StripeEvent;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function __construct(private readonly StripeService $stripeService) {}

    public function handle(Request $request): JsonResponse
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        try {
            $event = Webhook::constructEvent(
                $payload,
                $sigHeader,
                config('services.stripe.webhook_secret'),
            );
        } catch (SignatureVerificationException $e) {
            Log::warning('Stripe webhook signature failed', ['error' => $e->getMessage()]);
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        // Idempotency — skip if already processed
        $record = StripeEvent::firstOrCreate(
            ['stripe_event_id' => $event->id],
            [
                'event_type'   => $event->type,
                'livemode'     => (bool) ($event->livemode ?? false),
                'payload_json' => json_decode($payload, true),
            ],
        );

        if ($record->isProcessed()) {
            Log::info('Stripe webhook already processed', ['event_id' => $event->id, 'type' => $event->type]);
            return response()->json(['received' => true]);
        }

        try {
            match ($event->type) {
                'customer.subscription.created',
                'customer.subscription.updated'  => $this->handleSubscriptionUpsert($event->data->object),
                'customer.subscription.deleted'  => $this->handleSubscriptionDeleted($event->data->object),
                'invoice.payment_succeeded'      => $this->handlePaymentSucceeded($event->data->object),
                'invoice.payment_failed'         => $this->handlePaymentFailed($event->data->object),
                'invoice.upcoming'               => Log::info('Stripe invoice.upcoming received', ['event_id' => $event->id]),
                default                          => Log::info('Stripe webhook received (unhandled)', ['type' => $event->type, 'event_id' => $event->id]),
            };

            $record->update(['processed_at' => now()]);
        } catch (\Throwable $e) {
            $record->update(['error_message' => $e->getMessage()]);
            Log::error('Stripe webhook handler failed', [
                'event_id' => $event->id,
                'type'     => $event->type,
                'error'    => $e->getMessage(),
            ]);
        }

        return response()->json(['received' => true]);
    }

    // -------------------------------------------------------------------------

    private function handleSubscriptionUpsert(object $stripeSub): void
    {
        $org = Organization::where('stripe_customer_id', $stripeSub->customer)->first();

        if (!$org) {
            Log::warning('Stripe webhook: organization not found for customer', [
                'customer_id' => $stripeSub->customer,
                'event_type'  => 'subscription.created/updated',
            ]);
            return;
        }

        // Re-retrieve with expansion so syncSubscriptionToDatabase has full data
        $expanded = \Stripe\Subscription::retrieve([
            'id'     => $stripeSub->id,
            'expand' => ['default_payment_method'],
        ]);

        $this->stripeService->syncSubscriptionToDatabase($expanded, $org->id);
    }

    private function handleSubscriptionDeleted(object $stripeSub): void
    {
        $subscription = Subscription::where('stripe_subscription_id', $stripeSub->id)->first();

        if (!$subscription) {
            Log::warning('Stripe webhook: subscription not found for deletion', [
                'stripe_subscription_id' => $stripeSub->id,
            ]);
            return;
        }

        $subscription->update([
            'status'       => 'canceled',
            'stripe_status' => 'canceled',
            'ends_at'      => now(),
        ]);

        AuditLogService::record([
            'organization_id' => $subscription->organization_id,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'subscription_deleted_via_webhook',
            'metadata'        => ['stripe_subscription_id' => $stripeSub->id],
        ]);
    }

    private function handlePaymentSucceeded(object $invoice): void
    {
        $org = Organization::where('stripe_customer_id', $invoice->customer)->first();

        if (!$org) {
            Log::warning('Stripe webhook: organization not found for payment_succeeded', [
                'customer_id' => $invoice->customer,
            ]);
            return;
        }

        $subscription = Subscription::where('organization_id', $org->id)
            ->whereNotIn('status', ['canceled', 'expired'])
            ->latest('current_period_end')
            ->first();

        if (!$subscription) {
            return;
        }

        $periodStart = $invoice->period_start
            ? Carbon::createFromTimestamp($invoice->period_start)
            : null;
        $periodEnd = $invoice->period_end
            ? Carbon::createFromTimestamp($invoice->period_end)
            : null;

        $subscription->update([
            'status'               => 'active',
            'stripe_status'        => 'active',
            'current_period_start' => $periodStart,
            'current_period_end'   => $periodEnd,
            'ends_at'              => $periodEnd,
        ]);

        AuditLogService::record([
            'organization_id' => $org->id,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'payment_succeeded',
            'metadata'        => [
                'amount_paid_cents'  => $invoice->amount_paid,
                'invoice_id'         => $invoice->id,
                'period_start'       => $periodStart?->toIso8601String(),
                'period_end'         => $periodEnd?->toIso8601String(),
            ],
        ]);
    }

    private function handlePaymentFailed(object $invoice): void
    {
        $org = Organization::where('stripe_customer_id', $invoice->customer)->first();

        if (!$org) {
            Log::warning('Stripe webhook: organization not found for payment_failed', [
                'customer_id' => $invoice->customer,
            ]);
            return;
        }

        $subscription = Subscription::where('organization_id', $org->id)
            ->whereNotIn('status', ['canceled', 'expired'])
            ->latest('current_period_end')
            ->first();

        if (!$subscription) {
            return;
        }

        $subscription->update([
            'status'        => 'past_due',
            'stripe_status' => 'past_due',
        ]);

        $nextAttempt = isset($invoice->next_payment_attempt)
            ? Carbon::createFromTimestamp($invoice->next_payment_attempt)->toIso8601String()
            : null;

        AuditLogService::record([
            'organization_id' => $org->id,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'payment_failed',
            'metadata'        => [
                'invoice_id'           => $invoice->id,
                'attempt_count'        => $invoice->attempt_count ?? null,
                'next_payment_attempt' => $nextAttempt,
            ],
        ]);

        // TODO Phase 2: queue payment failure email to org owner / billing_admin
    }
}
