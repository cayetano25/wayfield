<?php

namespace App\Domain\Billing\Services;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Organization;
use App\Models\Subscription;
use InvalidArgumentException;
use Stripe\Exception\ApiErrorException;
use Stripe\SetupIntent;
use Stripe\Stripe;
use Stripe\Subscription as StripeSubscription;

class StripeService
{
    /** @var array<string, array<string, string>> */
    private array $priceMap;

    public function __construct()
    {
        $this->priceMap = [
            'starter' => [
                'monthly' => config('services.stripe.prices.creator_monthly'),
                'annual'  => config('services.stripe.prices.creator_annual'),
            ],
            'pro' => [
                'monthly' => config('services.stripe.prices.studio_monthly'),
                'annual'  => config('services.stripe.prices.studio_annual'),
            ],
        ];
    }

    /**
     * Return the Stripe customer ID for the org, creating one if needed.
     */
    public function getOrCreateCustomer(Organization $org): string
    {
        if ($org->stripe_customer_id) {
            return $org->stripe_customer_id;
        }

        $customer = \Stripe\Customer::create([
            'name'     => $org->name,
            'email'    => $org->primary_contact_email,
            'metadata' => ['wayfield_organization_id' => $org->id],
        ]);

        $org->update(['stripe_customer_id' => $customer->id]);

        return $customer->id;
    }

    /**
     * Map a plan code + billing interval to a Stripe Price ID.
     *
     * @throws InvalidArgumentException for free/enterprise plans
     */
    public function resolvePriceId(string $planCode, string $interval): string
    {
        if (!isset($this->priceMap[$planCode])) {
            throw new InvalidArgumentException(
                "Plan code '{$planCode}' does not have a Stripe price. Only 'starter' and 'pro' are billable."
            );
        }

        if (!array_key_exists($interval, $this->priceMap[$planCode])) {
            throw new InvalidArgumentException(
                "Invalid billing interval '{$interval}'. Expected 'monthly' or 'annual'."
            );
        }

        $priceId = $this->priceMap[$planCode][$interval];

        if (!$priceId) {
            throw new InvalidArgumentException(
                "Stripe Price ID for '{$planCode}/{$interval}' is not configured. Check STRIPE_PRICE_* env vars."
            );
        }

        return $priceId;
    }

    /**
     * Create a Stripe SetupIntent and return its client_secret.
     */
    public function createSetupIntent(string $customerId): string
    {
        $intent = SetupIntent::create([
            'customer' => $customerId,
            'automatic_payment_methods' => ['enabled' => true],
        ]);

        return $intent->client_secret;
    }

    /**
     * Attach a payment method, set it as default, and create a subscription.
     */
    public function createSubscription(
        Organization $org,
        string $priceId,
        string $paymentMethodId,
        string $interval
    ): StripeSubscription {
        $customerId = $this->getOrCreateCustomer($org);

        \Stripe\PaymentMethod::retrieve($paymentMethodId)->attach([
            'customer' => $customerId,
        ]);

        \Stripe\Customer::update($customerId, [
            'invoice_settings' => ['default_payment_method' => $paymentMethodId],
        ]);

        return StripeSubscription::create([
            'customer'               => $customerId,
            'items'                  => [['price' => $priceId]],
            'default_payment_method' => $paymentMethodId,
            'expand'                 => [
                'latest_invoice.payment_intent',
                'default_payment_method',
            ],
        ]);
    }

    /**
     * Schedule subscription cancellation at period end.
     */
    public function cancelSubscription(string $stripeSubscriptionId): void
    {
        StripeSubscription::update($stripeSubscriptionId, [
            'cancel_at_period_end' => true,
        ]);
    }

    /**
     * Remove pending cancellation, resuming the subscription.
     */
    public function resumeSubscription(string $stripeSubscriptionId): void
    {
        StripeSubscription::update($stripeSubscriptionId, [
            'cancel_at_period_end' => false,
        ]);
    }

    /**
     * Create a Stripe Billing Portal session and return its URL.
     */
    public function getPortalUrl(string $customerId, string $returnUrl): string
    {
        $session = \Stripe\BillingPortal\Session::create([
            'customer'   => $customerId,
            'return_url' => $returnUrl,
        ]);

        return $session->url;
    }

    /**
     * Sync a Stripe Subscription object into the local subscriptions table.
     */
    public function syncSubscriptionToDatabase(
        StripeSubscription $stripeSub,
        int $organizationId
    ): void {
        $priceId  = $stripeSub->items->data[0]->price->id ?? null;
        $planCode = $this->planCodeFromPriceId($priceId);
        $interval = $stripeSub->items->data[0]->price->recurring->interval === 'year' ? 'annual' : 'monthly';

        $stripeStatus  = $stripeSub->status;
        $wayieldStatus = $this->mapStripeStatus($stripeStatus);

        $paymentMethod = $stripeSub->default_payment_method;
        $cardBrand     = null;
        $cardLast4     = null;
        $cardExpMonth  = null;
        $cardExpYear   = null;

        if ($paymentMethod && is_object($paymentMethod) && isset($paymentMethod->card)) {
            $card         = $paymentMethod->card;
            $cardBrand    = $card->brand    ?? null;
            $cardLast4    = $card->last4    ?? null;
            $cardExpMonth = $card->exp_month ?? null;
            $cardExpYear  = $card->exp_year  ?? null;
        }

        $periodStart = $stripeSub->current_period_start
            ? \Carbon\Carbon::createFromTimestamp($stripeSub->current_period_start)
            : null;
        $periodEnd = $stripeSub->current_period_end
            ? \Carbon\Carbon::createFromTimestamp($stripeSub->current_period_end)
            : null;
        $canceledAt = $stripeSub->canceled_at
            ? \Carbon\Carbon::createFromTimestamp($stripeSub->canceled_at)
            : null;

        Subscription::updateOrCreate(
            ['stripe_subscription_id' => $stripeSub->id],
            [
                'organization_id'          => $organizationId,
                'stripe_price_id'          => $priceId,
                'stripe_status'            => $stripeStatus,
                'plan_code'                => $planCode,
                'billing_interval'         => $interval,
                'status'                   => $wayieldStatus,
                'current_period_start'     => $periodStart,
                'current_period_end'       => $periodEnd,
                'starts_at'                => $periodStart ?? now(),
                'ends_at'                  => $periodEnd,
                'cancel_at_period_end'     => (bool) $stripeSub->cancel_at_period_end,
                'canceled_at'              => $canceledAt,
                'default_payment_method_id' => is_object($paymentMethod) ? $paymentMethod->id : $paymentMethod,
                'card_brand'               => $cardBrand,
                'card_last_four'           => $cardLast4,
                'card_exp_month'           => $cardExpMonth,
                'card_exp_year'            => $cardExpYear,
            ]
        );

        AuditLogService::record([
            'organization_id' => $organizationId,
            'entity_type'     => 'subscription',
            'action'          => 'subscription_synced',
            'metadata'        => [
                'plan_code'        => $planCode,
                'stripe_status'    => $stripeStatus,
                'billing_interval' => $interval,
            ],
        ]);
    }

    // -------------------------------------------------------------------------

    private function mapStripeStatus(string $stripeStatus): string
    {
        return match ($stripeStatus) {
            'active'             => 'active',
            'trialing'           => 'trialing',
            'past_due', 'unpaid', 'incomplete' => 'past_due',
            'canceled'           => 'canceled',
            'incomplete_expired' => 'expired',
            default              => 'past_due',
        };
    }

    private function planCodeFromPriceId(?string $priceId): string
    {
        if (!$priceId) {
            return 'unknown';
        }

        foreach ($this->priceMap as $planCode => $intervals) {
            if (in_array($priceId, $intervals, true)) {
                return $planCode;
            }
        }

        return 'unknown';
    }
}
