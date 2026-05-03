<?php

use App\Domain\Billing\Services\StripeService;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stripe\ApiRequestor;
use Stripe\HttpClient\ClientInterface;
use Stripe\Subscription as StripeSubscription;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * The test price ID we use for the starter/monthly plan in all syncSubscriptionToDatabase tests.
 * Must match what is configured via config() before tests that call sync.
 */
const TEST_STARTER_MONTHLY_PRICE_ID = 'price_starter_monthly_test';
const TEST_PRO_ANNUAL_PRICE_ID      = 'price_pro_annual_test';

/**
 * Configure Stripe price IDs in config so planCodeFromPriceId() resolves them.
 * Call this at the top of any test that exercises syncSubscriptionToDatabase.
 */
function configureTestPriceIds(): void
{
    config([
        'services.stripe.prices.creator_monthly' => TEST_STARTER_MONTHLY_PRICE_ID,
        'services.stripe.prices.creator_annual'  => 'price_starter_annual_test',
        'services.stripe.prices.studio_monthly'  => 'price_pro_monthly_test',
        'services.stripe.prices.studio_annual'   => TEST_PRO_ANNUAL_PRICE_ID,
    ]);
}

/**
 * Build a fake \Stripe\Subscription using constructFrom so no HTTP call is made.
 * The default price ID matches TEST_STARTER_MONTHLY_PRICE_ID.
 */
function fakeStripeSub(array $overrides = []): StripeSubscription
{
    $defaults = [
        'id'                   => 'sub_test_' . uniqid(),
        'object'               => 'subscription',
        'status'               => 'active',
        'cancel_at_period_end' => false,
        'canceled_at'          => null,
        'current_period_start' => now()->subMonth()->timestamp,
        'current_period_end'   => now()->addMonth()->timestamp,
        'default_payment_method' => null,
        'items'                => [
            'object'   => 'list',
            'has_more' => false,
            'url'      => '/v1/subscription_items',
            'data'     => [
                [
                    'price' => [
                        'id'        => TEST_STARTER_MONTHLY_PRICE_ID,
                        'recurring' => ['interval' => 'month'],
                    ],
                ],
            ],
        ],
    ];

    return StripeSubscription::constructFrom(array_merge($defaults, $overrides));
}

/**
 * Inject a fake Stripe HTTP client that returns a customer JSON response.
 * Restores the original client in afterEach.
 */
function injectFakeStripeHttpClient(string $customerId = 'cus_fake_test123'): void
{
    $fake = new class ($customerId) implements ClientInterface {
        public function __construct(private string $customerId) {}

        public function request($method, $absUrl, $headers, $params, $hasFile, $apiMode = 'v1', $maxNetworkRetries = null): array
        {
            $body = json_encode([
                'id'     => $this->customerId,
                'object' => 'customer',
            ]);

            return [$body, 200, []];
        }
    };

    ApiRequestor::setHttpClient($fake);
}

afterEach(function () {
    // Reset Stripe HTTP client to default after any test that injects a fake.
    ApiRequestor::setHttpClient(null);
});

// ─── resolvePriceId ───────────────────────────────────────────────────────────

test('resolvePriceId returns the configured price ID for starter/monthly', function () {
    configureTestPriceIds();

    $service = new StripeService();
    expect($service->resolvePriceId('creator', 'monthly'))->toBe(TEST_STARTER_MONTHLY_PRICE_ID);
});

test('resolvePriceId returns the configured price ID for starter/annual', function () {
    configureTestPriceIds();

    $service = new StripeService();
    expect($service->resolvePriceId('creator', 'annual'))->toBe('price_starter_annual_test');
});

test('resolvePriceId returns the configured price ID for pro/monthly', function () {
    configureTestPriceIds();

    $service = new StripeService();
    expect($service->resolvePriceId('studio', 'monthly'))->toBe('price_pro_monthly_test');
});

test('resolvePriceId returns the configured price ID for pro/annual', function () {
    configureTestPriceIds();

    $service = new StripeService();
    expect($service->resolvePriceId('studio', 'annual'))->toBe(TEST_PRO_ANNUAL_PRICE_ID);
});

test('resolvePriceId throws InvalidArgumentException for free plan', function () {
    $service = new StripeService();
    expect(fn () => $service->resolvePriceId('foundation', 'monthly'))
        ->toThrow(\InvalidArgumentException::class);
});

test('resolvePriceId throws InvalidArgumentException for enterprise plan', function () {
    $service = new StripeService();
    expect(fn () => $service->resolvePriceId('enterprise', 'monthly'))
        ->toThrow(\InvalidArgumentException::class);
});

test('resolvePriceId throws when price ID env var is not configured', function () {
    config(['services.stripe.prices.creator_monthly' => null]);

    $service = new StripeService();
    expect(fn () => $service->resolvePriceId('creator', 'monthly'))
        ->toThrow(\InvalidArgumentException::class);
});

// ─── getOrCreateCustomer ──────────────────────────────────────────────────────

test('getOrCreateCustomer returns existing stripe_customer_id without creating a duplicate', function () {
    $org = Organization::factory()->create(['stripe_customer_id' => 'cus_already_exists']);

    // No Stripe API call should occur — if the static Stripe create() were called
    // it would fail with a connection/auth error in test env.
    $service = new StripeService();
    $id = $service->getOrCreateCustomer($org);

    expect($id)->toBe('cus_already_exists');
    // Org record is unchanged
    expect($org->fresh()->stripe_customer_id)->toBe('cus_already_exists');
});

test('getOrCreateCustomer creates a Stripe customer and saves the ID to the org', function () {
    $org = Organization::factory()->create(['stripe_customer_id' => null]);

    injectFakeStripeHttpClient('cus_brand_new_999');
    \Stripe\Stripe::setApiKey('sk_test_fake');

    $service = new StripeService();
    $id      = $service->getOrCreateCustomer($org);

    expect($id)->toBe('cus_brand_new_999');
    expect($org->fresh()->stripe_customer_id)->toBe('cus_brand_new_999');
});

// ─── syncSubscriptionToDatabase — status mapping ──────────────────────────────

dataset('stripe_status_map', [
    ['active',             'active'],
    ['trialing',           'trialing'],
    ['past_due',           'past_due'],
    ['unpaid',             'past_due'],
    ['incomplete',         'past_due'],
    ['canceled',           'canceled'],
    ['incomplete_expired', 'expired'],
]);

test('syncSubscriptionToDatabase maps Stripe status to local status', function (string $stripeStatus, string $expectedLocal) {
    configureTestPriceIds();

    $org     = Organization::factory()->create();
    $stripeSub = fakeStripeSub(['status' => $stripeStatus, 'id' => 'sub_' . uniqid()]);

    $service = new StripeService();
    $service->syncSubscriptionToDatabase($stripeSub, $org->id);

    $this->assertDatabaseHas('subscriptions', [
        'organization_id' => $org->id,
        'stripe_status'   => $stripeStatus,
        'status'          => $expectedLocal,
    ]);
})->with('stripe_status_map');

// ─── syncSubscriptionToDatabase — audit log ───────────────────────────────────

test('syncSubscriptionToDatabase writes an audit_log entry on every call', function () {
    configureTestPriceIds();

    $org     = Organization::factory()->create();
    $subId   = 'sub_audit_' . uniqid();
    $stripeSub = fakeStripeSub(['id' => $subId]);

    $service = new StripeService();
    $service->syncSubscriptionToDatabase($stripeSub, $org->id);

    // First call
    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'entity_type'     => 'subscription',
        'action'          => 'subscription_synced',
    ]);

    // Second call (different sub ID to avoid updateOrCreate collision) — still logs
    $stripeSub2 = fakeStripeSub(['id' => 'sub_audit_2_' . uniqid()]);
    $service->syncSubscriptionToDatabase($stripeSub2, $org->id);

    expect(AuditLog::where('organization_id', $org->id)->where('action', 'subscription_synced')->count())->toBe(2);
});

test('syncSubscriptionToDatabase upserts — calling twice with same sub ID does not duplicate the row', function () {
    configureTestPriceIds();

    $org       = Organization::factory()->create();
    $subId     = 'sub_upsert_' . uniqid();
    $stripeSub = fakeStripeSub(['id' => $subId]);

    $service = new StripeService();
    $service->syncSubscriptionToDatabase($stripeSub, $org->id);
    $service->syncSubscriptionToDatabase($stripeSub, $org->id);

    expect(Subscription::where('stripe_subscription_id', $subId)->count())->toBe(1);
});

test('syncSubscriptionToDatabase maps annual billing interval correctly', function () {
    configureTestPriceIds();

    $org = Organization::factory()->create();
    $stripeSub = fakeStripeSub([
        'id' => 'sub_annual_' . uniqid(),
        'items' => [
            'object'   => 'list',
            'has_more' => false,
            'url'      => '/v1/subscription_items',
            'data'     => [
                [
                    'price' => [
                        'id'        => TEST_PRO_ANNUAL_PRICE_ID,
                        'recurring' => ['interval' => 'year'],
                    ],
                ],
            ],
        ],
    ]);

    $service = new StripeService();
    $service->syncSubscriptionToDatabase($stripeSub, $org->id);

    $this->assertDatabaseHas('subscriptions', [
        'organization_id'  => $org->id,
        'billing_interval' => 'annual',
    ]);
});
