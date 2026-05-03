<?php

use App\Jobs\ProcessStripeBillingWebhookJob;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a raw Stripe webhook payload + valid signature header.
 * Returns [$payloadJson, $signatureHeader].
 */
function signedWebhook(array $eventData, string $secret): array
{
    $payload   = json_encode($eventData);
    $timestamp = time();
    $sig       = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);
    $header    = "t={$timestamp},v1={$sig}";

    return [$payload, $header];
}

/**
 * POST to the canonical webhook endpoint /api/webhooks/stripe.
 */
function webhookPost(string $payload, string $signature): \Illuminate\Testing\TestResponse
{
    return test()->call(
        'POST',
        '/api/webhooks/stripe',
        [],
        [],
        [],
        ['HTTP_Stripe-Signature' => $signature, 'CONTENT_TYPE' => 'application/json'],
        $payload,
    );
}

function webhookSecret(): string
{
    $secret = 'whsec_test_' . uniqid();
    config(['stripe.webhook_secret' => $secret]);
    return $secret;
}

function orgWithStripeCustomer(string $customerId): Organization
{
    return Organization::factory()->create(['stripe_customer_id' => $customerId]);
}

function activeSubscription(int $orgId, string $stripeSubId): Subscription
{
    return Subscription::factory()->forOrganization($orgId)->creator()->active()->create([
        'stripe_subscription_id' => $stripeSubId,
        'stripe_status'          => 'active',
        'current_period_end'     => now()->addMonth(),
    ]);
}

// ─── Signature verification ───────────────────────────────────────────────────

test('valid signed event returns 200', function () {
    $secret = webhookSecret();

    [$payload, $sig] = signedWebhook([
        'id'       => 'evt_test_valid',
        'type'     => 'invoice.upcoming',
        'livemode' => false,
        'data'     => ['object' => []],
    ], $secret);

    webhookPost($payload, $sig)->assertOk();
});

test('invalid signature returns 400', function () {
    webhookSecret();

    $payload = json_encode(['id' => 'evt_test', 'type' => 'invoice.upcoming', 'livemode' => false, 'data' => ['object' => []]]);

    webhookPost($payload, 't=1234567890,v1=badsignature')->assertStatus(400);
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

test('processing the same event twice is idempotent', function () {
    $secret     = webhookSecret();
    $customerId = 'cus_idempotent';
    $org        = orgWithStripeCustomer($customerId);

    Subscription::factory()->forOrganization($org->id)->active()->create([
        'stripe_subscription_id' => 'sub_idempotent',
        'stripe_status'          => 'active',
    ]);

    $eventId = 'evt_idem_' . uniqid();

    $eventData = [
        'id'       => $eventId,
        'type'     => 'invoice.payment_failed',
        'livemode' => false,
        'data'     => [
            'object' => [
                'id'                   => 'in_test',
                'customer'             => $customerId,
                'attempt_count'        => 1,
                'next_payment_attempt' => null,
            ],
        ],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    // First call: dispatches job (sync queue), job runs, audit log created, cache set.
    webhookPost($payload, $sig)->assertOk();
    expect(AuditLog::where('action', 'payment_failed')->count())->toBe(1);

    // Second call: cache hit — returns 200 without re-dispatching.
    webhookPost($payload, $sig)->assertOk();
    expect(AuditLog::where('action', 'payment_failed')->count())->toBe(1);
});

// ─── customer.subscription.updated ───────────────────────────────────────────

test('subscription.updated dispatches ProcessStripeBillingWebhookJob', function () {
    // This event triggers handleSubscriptionUpsert which calls \Stripe\Subscription::retrieve
    // — a real Stripe API call that will fail in the test environment. We use Queue::fake()
    // to verify the job is dispatched without actually executing it.
    Queue::fake();

    $secret     = webhookSecret();
    $customerId = 'cus_sub_updated';
    $subId      = 'sub_sub_updated';
    orgWithStripeCustomer($customerId);

    $eventData = [
        'id'       => 'evt_sub_updated_' . uniqid(),
        'type'     => 'customer.subscription.updated',
        'livemode' => false,
        'data'     => [
            'object' => [
                'id'       => $subId,
                'customer' => $customerId,
                'status'   => 'active',
            ],
        ],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    webhookPost($payload, $sig)->assertOk();

    Queue::assertPushed(ProcessStripeBillingWebhookJob::class);
});

// ─── invoice.payment_failed ──────────────────────────────────────────────────

test('payment_failed sets subscription status to past_due', function () {
    $secret     = webhookSecret();
    $customerId = 'cus_pay_failed';
    $org        = orgWithStripeCustomer($customerId);
    $sub        = activeSubscription($org->id, 'sub_pay_failed');

    $eventData = [
        'id'       => 'evt_pay_failed_' . uniqid(),
        'type'     => 'invoice.payment_failed',
        'livemode' => false,
        'data'     => [
            'object' => [
                'id'                   => 'in_test_failed',
                'customer'             => $customerId,
                'attempt_count'        => 2,
                'next_payment_attempt' => now()->addDays(3)->timestamp,
            ],
        ],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    webhookPost($payload, $sig)->assertOk();

    $sub->refresh();
    expect($sub->status)->toBe('past_due');
    expect($sub->stripe_status)->toBe('past_due');

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'action'          => 'payment_failed',
    ]);
});

test('payment_failed for unknown customer still returns 200', function () {
    $secret = webhookSecret();

    $eventData = [
        'id'       => 'evt_unknown_cus_' . uniqid(),
        'type'     => 'invoice.payment_failed',
        'livemode' => false,
        'data'     => [
            'object' => [
                'id'                   => 'in_test_unknown',
                'customer'             => 'cus_nonexistent',
                'attempt_count'        => 1,
                'next_payment_attempt' => null,
            ],
        ],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    webhookPost($payload, $sig)->assertOk();
});

// ─── invoice.payment_succeeded ───────────────────────────────────────────────

test('payment_succeeded sets subscription to active and writes audit log', function () {
    $secret     = webhookSecret();
    $customerId = 'cus_pay_ok';
    $org        = orgWithStripeCustomer($customerId);

    $sub = Subscription::factory()->forOrganization($org->id)->creator()->create([
        'stripe_status' => 'past_due',
        'status'        => 'past_due',
    ]);

    $periodStart = now()->subDay()->timestamp;
    $periodEnd   = now()->addMonth()->timestamp;

    $eventData = [
        'id'       => 'evt_pay_ok_' . uniqid(),
        'type'     => 'invoice.payment_succeeded',
        'livemode' => false,
        'data'     => [
            'object' => [
                'id'           => 'in_test_ok',
                'customer'     => $customerId,
                'amount_paid'  => 4900,
                'period_start' => $periodStart,
                'period_end'   => $periodEnd,
            ],
        ],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    webhookPost($payload, $sig)->assertOk();

    $sub->refresh();
    expect($sub->status)->toBe('active');
    expect($sub->stripe_status)->toBe('active');

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'action'          => 'payment_succeeded',
    ]);
});

// ─── customer.subscription.deleted ───────────────────────────────────────────

test('subscription.deleted cancels local subscription and resets plan to free', function () {
    $secret     = webhookSecret();
    $subId      = 'sub_deleted_' . uniqid();
    $customerId = 'cus_deleted_' . uniqid();
    $org        = Organization::factory()->create(['stripe_customer_id' => $customerId]);
    $sub        = activeSubscription($org->id, $subId);

    $eventData = [
        'id'       => 'evt_sub_deleted_' . uniqid(),
        'type'     => 'customer.subscription.deleted',
        'livemode' => false,
        'data'     => [
            'object' => [
                'id'       => $subId,
                'customer' => $customerId,
                'status'   => 'canceled',
            ],
        ],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    webhookPost($payload, $sig)->assertOk();

    $sub->refresh();
    expect($sub->status)->toBe('canceled');
    expect($sub->stripe_status)->toBe('canceled');
    expect($sub->ends_at)->not->toBeNull();
    expect($sub->plan_code)->toBe('foundation');

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'action'          => 'subscription_deleted_via_webhook',
    ]);
});

// ─── Unhandled events ────────────────────────────────────────────────────────

test('unhandled event type returns 200 without error', function () {
    $secret = webhookSecret();

    $eventData = [
        'id'       => 'evt_unhandled_' . uniqid(),
        'type'     => 'charge.refunded',
        'livemode' => false,
        'data'     => ['object' => ['id' => 'ch_test']],
    ];

    [$payload, $sig] = signedWebhook($eventData, $secret);

    webhookPost($payload, $sig)->assertOk();
});

// ─── Job dispatch ─────────────────────────────────────────────────────────────

test('every valid event dispatches ProcessStripeBillingWebhookJob', function () {
    Queue::fake();

    $secret = webhookSecret();
    $id     = 'evt_logged_' . uniqid();

    [$payload, $sig] = signedWebhook([
        'id'       => $id,
        'type'     => 'invoice.upcoming',
        'livemode' => false,
        'data'     => ['object' => []],
    ], $secret);

    webhookPost($payload, $sig)->assertOk();

    Queue::assertPushed(ProcessStripeBillingWebhookJob::class);
});

// ─── Legacy route deprecation ────────────────────────────────────────────────

test('legacy /api/v1/stripe/webhook returns 200 with deprecation response', function () {
    $response = test()->call(
        'POST',
        '/api/v1/stripe/webhook',
        [],
        [],
        [],
        ['CONTENT_TYPE' => 'application/json'],
        json_encode(['id' => 'evt_legacy', 'type' => 'invoice.upcoming']),
    );

    $response->assertOk();
    expect($response->getContent())->toContain('Deprecated');
});

test('legacy /api/v1/billing/webhook returns 200 with deprecation response', function () {
    $response = test()->call(
        'POST',
        '/api/v1/billing/webhook',
        [],
        [],
        [],
        ['CONTENT_TYPE' => 'application/json'],
        json_encode(['id' => 'evt_legacy', 'type' => 'checkout.session.completed']),
    );

    $response->assertOk();
    expect($response->getContent())->toContain('Deprecated');
});
