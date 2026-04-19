<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Billing\Actions\CancelSubscriptionAction;
use App\Domain\Billing\Actions\ResumeSubscriptionAction;
use App\Domain\Billing\Services\StripeService;
use App\Domain\Shared\Services\AuditLogService;
use App\Domain\Subscriptions\Services\EnforceFeatureGateService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SubscribeToPlanRequest;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Stripe\BillingPortal\Session as StripeBillingSession;
use Stripe\Checkout\Session as StripeCheckoutSession;
use Stripe\Customer;
use Stripe\Exception\CardException;
use Stripe\Exception\InvalidRequestException;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Stripe;
use Stripe\Webhook;

class BillingController extends Controller
{
    public function __construct(
        private readonly EnforceFeatureGateService $featureGate,
        private readonly StripeService $stripeService,
        private readonly CancelSubscriptionAction $cancelAction,
        private readonly ResumeSubscriptionAction $resumeAction,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/organizations/{organization}/billing
    // Auth: owner, billing_admin
    // ─────────────────────────────────────────────────────────────────────────

    public function index(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('billing.view', $organization);

        return response()->json($this->billingState($organization));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/organizations/{organization}/billing/setup-intent
    // Auth: owner, billing_admin
    // ─────────────────────────────────────────────────────────────────────────

    public function setupIntent(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('billing.manage', $organization);

        $customerId = $this->stripeService->getOrCreateCustomer($organization);

        return response()->json([
            'client_secret' => $this->stripeService->createSetupIntent($customerId),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/organizations/{organization}/billing/subscribe
    // Auth: owner, billing_admin
    // ─────────────────────────────────────────────────────────────────────────

    public function subscribe(SubscribeToPlanRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('billing.manage', $organization);

        $planCode         = $request->input('plan_code');
        $interval         = $request->input('interval');
        $paymentMethodId  = $request->input('payment_method_id');

        try {
            $priceId     = $this->stripeService->resolvePriceId($planCode, $interval);
            $stripeSub   = $this->stripeService->createSubscription($organization, $priceId, $paymentMethodId, $interval);
            $this->stripeService->syncSubscriptionToDatabase($stripeSub, $organization->id);
        } catch (CardException $e) {
            return response()->json(['error' => $e->getError()->message], 422);
        } catch (InvalidRequestException $e) {
            return response()->json(['error' => $e->getError()->message ?? $e->getMessage()], 422);
        }

        $organization->refresh();

        return response()->json($this->billingState($organization));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/organizations/{organization}/billing/cancel
    // Auth: owner only
    // ─────────────────────────────────────────────────────────────────────────

    public function cancel(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('billing.cancel', $organization);

        $subscription = $organization->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('current_period_end')
            ->first();

        if (!$subscription?->stripe_subscription_id) {
            return response()->json(['error' => 'No active subscription to cancel.'], 422);
        }

        $this->cancelAction->execute($subscription, $request->user()->id);

        $organization->refresh();

        return response()->json($this->billingState($organization));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/organizations/{organization}/billing/resume
    // Auth: owner, billing_admin
    // ─────────────────────────────────────────────────────────────────────────

    public function resume(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('billing.manage', $organization);

        $subscription = $organization->subscriptions()
            ->where('cancel_at_period_end', true)
            ->whereIn('status', ['active', 'trialing'])
            ->latest('current_period_end')
            ->first();

        if (!$subscription?->stripe_subscription_id) {
            return response()->json(['error' => 'No subscription pending cancellation to resume.'], 422);
        }

        $this->resumeAction->execute($subscription, $request->user()->id);

        $organization->refresh();

        return response()->json($this->billingState($organization));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/organizations/{organization}/billing/portal
    // Auth: owner, billing_admin
    // ─────────────────────────────────────────────────────────────────────────

    public function billingPortal(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('billing.portal', $organization);

        if (!$organization->stripe_customer_id) {
            return response()->json(['error' => 'No Stripe customer found for this organization.'], 422);
        }

        $returnUrl = config('app.frontend_url').'/settings/billing';

        return response()->json([
            'url' => $this->stripeService->getPortalUrl($organization->stripe_customer_id, $returnUrl),
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/organizations/{organization}/billing/checkout
    // Auth: owner or billing_admin only
    // ─────────────────────────────────────────────────────────────────────────

    public function checkout(Request $request, Organization $organization): JsonResponse
    {
        $data = $request->validate([
            'plan_code' => ['required', Rule::in(['starter', 'pro'])],
            'billing' => ['required', Rule::in(['monthly', 'annual'])],
        ]);

        $org = $organization;

        // Only owner or billing_admin may manage billing.
        if (! $org->hasBillingAccess($request->user())) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $planCode = $data['plan_code'];
        $billing = $data['billing'];

        $priceId = config("plans.pricing.{$planCode}.stripe_{$billing}_price_id");

        if (! $priceId) {
            return response()->json([
                'error' => 'stripe_not_configured',
                'message' => "No Stripe price configured for {$planCode} {$billing}.",
            ], 422);
        }

        $stripeCustomerId = $this->resolveStripeCustomer($org, $request->user());

        $session = StripeCheckoutSession::create([
            'customer' => $stripeCustomerId,
            'mode' => 'subscription',
            'line_items' => [['price' => $priceId, 'quantity' => 1]],
            'success_url' => config('app.frontend_url').'/admin/organization/billing?success=1',
            'cancel_url' => config('app.frontend_url').'/admin/organization/billing?canceled=1',
            'metadata' => [
                'organization_id' => (string) $org->id,
                'plan_code' => $planCode,
                'billing' => $billing,
            ],
            'allow_promotion_codes' => true,
        ]);

        return response()->json(['checkout_url' => $session->url]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/organizations/{organization}/billing/portal
    // Auth: owner or billing_admin only
    // ─────────────────────────────────────────────────────────────────────────

    public function portal(Request $request, Organization $organization): JsonResponse
    {
        $org = $organization;

        if (! $org->hasBillingAccess($request->user())) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $subscription = $org->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('starts_at')
            ->first();

        if (! $subscription?->stripe_customer_id) {
            return response()->json([
                'error' => 'no_stripe_customer',
                'message' => 'No active Stripe subscription found for this organization.',
            ], 422);
        }

        $portalSession = StripeBillingSession::create([
            'customer' => $subscription->stripe_customer_id,
            'return_url' => config('app.frontend_url').'/admin/organization/billing',
        ]);

        return response()->json(['portal_url' => $portalSession->url]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/v1/billing/webhook
    // No auth — Stripe signature verification only.
    // This route is excluded from auth:sanctum and tenant.auth middleware.
    // ─────────────────────────────────────────────────────────────────────────

    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');

        try {
            $event = Webhook::constructEvent(
                $payload,
                $sigHeader,
                config('services.stripe.webhook_secret'),
            );
        } catch (SignatureVerificationException) {
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        match ($event->type) {
            'checkout.session.completed' => $this->handleCheckoutCompleted($event->data->object),
            'customer.subscription.updated' => $this->handleSubscriptionUpdated($event->data->object),
            'customer.subscription.deleted' => $this->handleSubscriptionDeleted($event->data->object),
            'invoice.payment_failed' => $this->handlePaymentFailed($event->data->object),
            default => null,
        };

        return response()->json(['received' => true]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/v1/organizations/{organization}/billing/status
    // Auth: any authenticated org member (data filtered by role in response)
    // ─────────────────────────────────────────────────────────────────────────

    public function status(Request $request, Organization $organization): JsonResponse
    {
        $org = $organization;
        $this->authorize('view', $org);

        $subscription = $org->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('starts_at')
            ->first();

        $planCode = $subscription?->plan_code ?? 'free';
        $displayName = config("plans.display_names.{$planCode}", ucfirst($planCode));

        // Usage
        $activeWorkshops = Workshop::where('organization_id', $org->id)
            ->whereIn('status', ['draft', 'published'])
            ->count();

        $participantsTotal = Registration::whereHas(
            'workshop',
            fn ($q) => $q->where('organization_id', $org->id)
        )->where('registration_status', 'registered')->count();

        // Next upgrade plan
        $order = config('plans.order', []);
        $currentIdx = array_search($planCode, $order, true);
        $nextCode = ($currentIdx !== false && isset($order[$currentIdx + 1]))
            ? $order[$currentIdx + 1]
            : null;

        $nextUpgrade = $nextCode ? [
            'plan_code' => $nextCode,
            'display_name' => config("plans.display_names.{$nextCode}"),
            'monthly_cents' => config("plans.pricing.{$nextCode}.monthly_cents"),
        ] : null;

        // Only expose stripe_customer_id to billing-access roles
        $hasBillingAccess = $org->hasBillingAccess($request->user());

        return response()->json([
            'plan_code' => $planCode,
            'display_name' => $displayName,
            'status' => $subscription?->status ?? 'none',
            'billing_cycle' => $subscription?->billing_cycle,
            'current_period_end' => $subscription?->current_period_end?->toIso8601String(),
            'stripe_customer_id' => $hasBillingAccess ? $subscription?->stripe_customer_id : null,
            'limits' => config("plans.limits.{$planCode}"),
            'features' => config("plans.features.{$planCode}"),
            'usage' => [
                'active_workshops' => $activeWorkshops,
                'participants_total' => $participantsTotal,
            ],
            'next_upgrade' => $nextUpgrade,
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Webhook event handlers
    // ─────────────────────────────────────────────────────────────────────────

    private function handleCheckoutCompleted(object $session): void
    {
        $orgId = (int) ($session->metadata->organization_id ?? 0);
        $planCode = $session->metadata->plan_code ?? null;
        $billing = $session->metadata->billing ?? null;

        if (! $orgId || ! $planCode) {
            return;
        }

        $org = Organization::find($orgId);
        if (! $org) {
            return;
        }

        $subscription = $org->subscriptions()->latest('starts_at')->first()
            ?? new Subscription(['organization_id' => $orgId]);

        $subscription->fill([
            'organization_id' => $orgId,
            'plan_code' => $planCode,
            'status' => 'active',
            'stripe_customer_id' => $session->customer,
            'stripe_subscription_id' => $session->subscription,
            'billing_cycle' => $billing,
            'starts_at' => now(),
        ]);
        $subscription->save();

        AuditLogService::record([
            'organization_id' => $orgId,
            'entity_type' => 'subscription',
            'entity_id' => $subscription->id,
            'action' => 'organization.plan_upgraded',
            'metadata' => [
                'plan_code' => $planCode,
                'billing' => $billing,
                'stripe_event' => 'checkout.session.completed',
            ],
        ]);
    }

    private function handleSubscriptionUpdated(object $stripeSub): void
    {
        $subscription = Subscription::where('stripe_subscription_id', $stripeSub->id)->first();
        if (! $subscription) {
            return;
        }

        $statusMap = [
            'active' => 'active',
            'trialing' => 'trialing',
            'past_due' => 'past_due',
            'canceled' => 'canceled',
            'unpaid' => 'past_due',
        ];

        $newStatus = $statusMap[$stripeSub->status] ?? $stripeSub->status;

        $periodEnd = $stripeSub->current_period_end
            ? Carbon::createFromTimestamp($stripeSub->current_period_end)
            : null;

        $subscription->update([
            'status' => $newStatus,
            'current_period_end' => $periodEnd,
        ]);
    }

    private function handleSubscriptionDeleted(object $stripeSub): void
    {
        $subscription = Subscription::where('stripe_subscription_id', $stripeSub->id)->first();
        if (! $subscription) {
            return;
        }

        $subscription->update([
            'plan_code' => 'free',
            'status' => 'canceled',
        ]);

        AuditLogService::record([
            'organization_id' => $subscription->organization_id,
            'entity_type' => 'subscription',
            'entity_id' => $subscription->id,
            'action' => 'organization.plan_canceled',
            'metadata' => ['stripe_event' => 'customer.subscription.deleted'],
        ]);
    }

    private function handlePaymentFailed(object $invoice): void
    {
        $stripeCustomerId = $invoice->customer ?? null;
        if (! $stripeCustomerId) {
            return;
        }

        $subscription = Subscription::where('stripe_customer_id', $stripeCustomerId)
            ->whereIn('status', ['active', 'trialing'])
            ->latest('starts_at')
            ->first();

        if (! $subscription) {
            return;
        }

        $subscription->update(['status' => 'past_due']);

        // TODO: queue notification to org owner (invoice.payment_failed)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // Billing state helper — shared by index, subscribe, cancel, resume
    // ─────────────────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function billingState(Organization $organization): array
    {
        $subscription = $organization->subscriptions()
            ->whereNotIn('status', ['expired'])
            ->latest('current_period_end')
            ->first();

        $planCode    = $subscription?->plan_code ?? 'free';
        $displayName = config("plans.display_names.{$planCode}", ucfirst($planCode));
        $planOrder   = config('plans.order', []);

        $availablePlans = array_map(function (string $code) use ($planCode): array {
            $catalog = config("plans.catalog.{$code}", []);
            return [
                'code'          => $code,
                'display_name'  => config("plans.display_names.{$code}", ucfirst($code)),
                'tagline'       => $catalog['tagline']      ?? null,
                'monthly_price' => $catalog['monthly_price'] ?? null,
                'annual_price'  => $catalog['annual_price']  ?? null,
                'annual_total'  => $catalog['annual_total']  ?? null,
                'highlight'     => $catalog['highlight']     ?? null,
                'features'      => $catalog['features']      ?? [],
                'is_current'    => $code === $planCode,
            ];
        }, $planOrder);

        return [
            'plan_code'           => $planCode,
            'plan_display_name'   => $displayName,
            'billing_interval'    => $subscription?->billing_interval,
            'stripe_status'       => $subscription?->stripe_status,
            'current_period_end'  => $subscription?->current_period_end?->toIso8601String(),
            'cancel_at_period_end' => (bool) ($subscription?->cancel_at_period_end ?? false),
            'canceled_at'         => $subscription?->canceled_at?->toIso8601String(),
            'trial_ends_at'       => $subscription?->trial_ends_at?->toIso8601String(),
            'card_brand'          => $subscription?->card_brand,
            'card_last_four'      => $subscription?->card_last_four,
            'card_exp_month'      => $subscription?->card_exp_month,
            'card_exp_year'       => $subscription?->card_exp_year,
            'available_plans'     => $availablePlans,
        ];
    }

    /**
     * Returns the Stripe customer ID for this org, creating one if needed.
     * Stores the new customer ID back on the subscription row.
     */
    private function resolveStripeCustomer(Organization $org, $user): string
    {
        $subscription = $org->subscriptions()->latest('starts_at')->first();

        if ($subscription?->stripe_customer_id) {
            return $subscription->stripe_customer_id;
        }

        $customer = Customer::create([
            'email' => $user->email,
            'name' => trim("{$user->first_name} {$user->last_name}"),
            'metadata' => ['organization_id' => (string) $org->id],
        ]);

        if ($subscription) {
            $subscription->update(['stripe_customer_id' => $customer->id]);
        } else {
            Subscription::create([
                'organization_id' => $org->id,
                'plan_code' => 'free',
                'status' => 'active',
                'stripe_customer_id' => $customer->id,
                'starts_at' => now(),
            ]);
        }

        return $customer->id;
    }
}
