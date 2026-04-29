<?php

namespace App\Jobs;

use App\Domain\Billing\Services\StripeService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Subscription;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessStripeBillingWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly array $eventData,
    ) {}

    public function handle(StripeService $stripeService): void
    {
        $eventType = $this->eventData['type'] ?? 'unknown';
        $eventId   = $this->eventData['id'] ?? 'unknown';

        Log::info('ProcessStripeBillingWebhookJob: processing', [
            'type'     => $eventType,
            'event_id' => $eventId,
        ]);

        match ($eventType) {
            'customer.subscription.created',
            'customer.subscription.updated'  => $this->handleSubscriptionUpsert($stripeService),
            'customer.subscription.deleted'  => $this->handleSubscriptionDeleted(),
            'invoice.payment_succeeded'      => $this->handleInvoicePaymentSucceeded(),
            'invoice.payment_failed'         => $this->handleInvoicePaymentFailed(),
            'invoice.upcoming'               => $this->handleInvoiceUpcoming(),
            'checkout.session.completed'     => $this->handleCheckoutSessionCompleted(),
            default => Log::info('ProcessStripeBillingWebhookJob: unhandled event type', [
                'type'     => $eventType,
                'event_id' => $eventId,
            ]),
        };
    }

    // ── Subscription lifecycle ─────────────────────────────────────────────────

    private function handleSubscriptionUpsert(StripeService $stripeService): void
    {
        $stripeSub  = $this->eventData['data']['object'];
        $customerId = $stripeSub['customer'];

        $org = Organization::where('stripe_customer_id', $customerId)->first();

        if (! $org) {
            Log::warning('ProcessStripeBillingWebhookJob: org not found for subscription event', [
                'customer_id' => $customerId,
                'event_type'  => $this->eventData['type'],
            ]);
            return;
        }

        // Re-retrieve with expansion so syncSubscriptionToDatabase has full data.
        $expanded = \Stripe\Subscription::retrieve([
            'id'     => $stripeSub['id'],
            'expand' => ['default_payment_method'],
        ]);

        $stripeService->syncSubscriptionToDatabase($expanded, $org->id);
    }

    private function handleSubscriptionDeleted(): void
    {
        $stripeSub    = $this->eventData['data']['object'];
        $subscription = Subscription::where('stripe_subscription_id', $stripeSub['id'])->first();

        if (! $subscription) {
            Log::warning('ProcessStripeBillingWebhookJob: subscription not found for deletion', [
                'stripe_subscription_id' => $stripeSub['id'],
            ]);
            return;
        }

        // Merged from both legacy controllers:
        // V1: stripe_status, ends_at
        // BillingController: plan_code reset to free
        $subscription->update([
            'status'        => 'canceled',
            'stripe_status' => 'canceled',
            'ends_at'       => now(),
            'plan_code'     => 'free',
        ]);

        AuditLogService::record([
            'organization_id' => $subscription->organization_id,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'subscription_deleted_via_webhook',
            'metadata'        => [
                'stripe_subscription_id' => $stripeSub['id'],
                'plan_code_reset_to'     => 'free',
            ],
        ]);
    }

    // ── Invoice / payment ──────────────────────────────────────────────────────

    private function handleInvoicePaymentSucceeded(): void
    {
        $invoice = $this->eventData['data']['object'];
        $org     = Organization::where('stripe_customer_id', $invoice['customer'])->first();

        if (! $org) {
            Log::warning('ProcessStripeBillingWebhookJob: org not found for payment_succeeded', [
                'customer_id' => $invoice['customer'],
            ]);
            return;
        }

        $subscription = Subscription::where('organization_id', $org->id)
            ->whereNotIn('status', ['canceled', 'expired'])
            ->latest('current_period_end')
            ->first();

        if (! $subscription) {
            return;
        }

        $periodStart = isset($invoice['period_start'])
            ? Carbon::createFromTimestamp($invoice['period_start'])
            : null;
        $periodEnd = isset($invoice['period_end'])
            ? Carbon::createFromTimestamp($invoice['period_end'])
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
                'amount_paid_cents' => $invoice['amount_paid'] ?? null,
                'invoice_id'        => $invoice['id'],
                'period_start'      => $periodStart?->toIso8601String(),
                'period_end'        => $periodEnd?->toIso8601String(),
            ],
        ]);
    }

    private function handleInvoicePaymentFailed(): void
    {
        $invoice = $this->eventData['data']['object'];
        $org     = Organization::where('stripe_customer_id', $invoice['customer'])->first();

        if (! $org) {
            Log::warning('ProcessStripeBillingWebhookJob: org not found for payment_failed', [
                'customer_id' => $invoice['customer'] ?? null,
            ]);
            return;
        }

        $subscription = Subscription::where('organization_id', $org->id)
            ->whereNotIn('status', ['canceled', 'expired'])
            ->latest('current_period_end')
            ->first();

        if (! $subscription) {
            return;
        }

        $subscription->update([
            'status'        => 'past_due',
            'stripe_status' => 'past_due',
        ]);

        $nextAttempt = isset($invoice['next_payment_attempt'])
            ? Carbon::createFromTimestamp($invoice['next_payment_attempt'])->toIso8601String()
            : null;

        AuditLogService::record([
            'organization_id' => $org->id,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'payment_failed',
            'metadata'        => [
                'invoice_id'           => $invoice['id'],
                'attempt_count'        => $invoice['attempt_count'] ?? null,
                'next_payment_attempt' => $nextAttempt,
            ],
        ]);

        // TODO: queue payment failure notification to org owner / billing_admin
    }

    private function handleInvoiceUpcoming(): void
    {
        $invoice    = $this->eventData['data']['object'];
        $customerId = $invoice['customer'] ?? null;

        $org = $customerId
            ? Organization::where('stripe_customer_id', $customerId)->first()
            : null;

        if (! $org) {
            Log::warning('ProcessStripeBillingWebhookJob: org not found for invoice.upcoming', [
                'customer_id'     => $customerId,
                'subscription_id' => $invoice['subscription'] ?? null,
            ]);
            return;
        }

        $amountDue = isset($invoice['amount_due'])
            ? '$' . number_format($invoice['amount_due'] / 100, 2)
            : 'your subscription fee';

        $renewalDate = isset($invoice['period_end'])
            ? Carbon::createFromTimestamp($invoice['period_end'])->toFormattedDateString()
            : 'soon';

        Notification::create([
            'organization_id'    => $org->id,
            'workshop_id'        => null,
            'created_by_user_id' => null,
            'notification_type'  => 'reminder',
            'sender_scope'       => 'organizer',
            'delivery_scope'     => 'all_participants',
            'title'              => 'Your subscription renews soon',
            'message'            => "Your Wayfield subscription will renew on {$renewalDate} for {$amountDue}. "
                                  . 'No action is needed if your payment details are up to date.',
        ]);

        AuditLogService::record([
            'organization_id' => $org->id,
            'entity_type'     => 'subscription',
            'entity_id'       => null,
            'action'          => 'billing.renewal_reminder_sent',
            'metadata'        => [
                'stripe_subscription_id' => $invoice['subscription'] ?? null,
                'amount_due_cents'       => $invoice['amount_due'] ?? null,
                'renewal_date'           => $renewalDate,
            ],
        ]);

        Log::info('ProcessStripeBillingWebhookJob: renewal reminder notification created', [
            'organization_id' => $org->id,
            'renewal_date'    => $renewalDate,
        ]);
    }

    // ── Checkout ───────────────────────────────────────────────────────────────

    private function handleCheckoutSessionCompleted(): void
    {
        $session  = $this->eventData['data']['object'];
        $orgId    = (int) ($session['metadata']['organization_id'] ?? 0);
        $planCode = $session['metadata']['plan_code'] ?? null;
        $billing  = $session['metadata']['billing'] ?? null;

        if (! $orgId || ! $planCode) {
            Log::warning('ProcessStripeBillingWebhookJob: missing metadata in checkout.session.completed', [
                'organization_id' => $orgId,
                'plan_code'       => $planCode,
            ]);
            return;
        }

        $org = Organization::find($orgId);
        if (! $org) {
            Log::warning('ProcessStripeBillingWebhookJob: org not found for checkout.session.completed', [
                'organization_id' => $orgId,
            ]);
            return;
        }

        $subscription = $org->subscriptions()->latest('starts_at')->first()
            ?? new Subscription(['organization_id' => $orgId]);

        $subscription->fill([
            'organization_id'        => $orgId,
            'plan_code'              => $planCode,
            'status'                 => 'active',
            'stripe_customer_id'     => $session['customer'],
            'stripe_subscription_id' => $session['subscription'],
            'billing_cycle'          => $billing,
            'starts_at'              => now(),
        ]);
        $subscription->save();

        AuditLogService::record([
            'organization_id' => $orgId,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'organization.plan_upgraded',
            'metadata'        => [
                'plan_code'    => $planCode,
                'billing'      => $billing,
                'stripe_event' => 'checkout.session.completed',
            ],
        ]);
    }
}
