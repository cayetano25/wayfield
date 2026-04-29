<?php

use App\Jobs\ProcessStripeBillingWebhookJob;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function billingEvent(array $overrides = []): array
{
    return array_merge([
        'id'       => 'evt_billing_' . uniqid(),
        'type'     => 'invoice.upcoming',
        'livemode' => false,
        'data'     => ['object' => []],
    ], $overrides);
}

function billingWebhookPost(array $event): \Illuminate\Testing\TestResponse
{
    $secret    = 'whsec_billing_test_' . uniqid();
    config(['stripe.webhook_secret' => $secret]);

    $payload   = json_encode($event);
    $timestamp = time();
    $sig       = hash_hmac('sha256', "{$timestamp}.{$payload}", $secret);
    $header    = "t={$timestamp},v1={$sig}";

    return test()->call(
        'POST',
        '/api/webhooks/stripe',
        [], [], [],
        ['HTTP_Stripe-Signature' => $header, 'CONTENT_TYPE' => 'application/json'],
        $payload,
    );
}

function billingWebhookPostRaw(string $payload, string $signatureHeader): \Illuminate\Testing\TestResponse
{
    return test()->call(
        'POST',
        '/api/webhooks/stripe',
        [], [], [],
        ['HTTP_Stripe-Signature' => $signatureHeader, 'CONTENT_TYPE' => 'application/json'],
        $payload,
    );
}

function billingOrgWithCustomer(string $customerId): Organization
{
    return Organization::factory()->create(['stripe_customer_id' => $customerId]);
}

// ─── Signature verification ───────────────────────────────────────────────────

test('invalid signature returns 400', function () {
    config(['stripe.webhook_secret' => 'whsec_billing_real_' . uniqid()]);

    $payload = json_encode(billingEvent());

    billingWebhookPostRaw($payload, 't=1234567890,v1=invalidsignature')
        ->assertStatus(400);
});

test('valid signed event returns 200 and dispatches job', function () {
    Queue::fake();

    billingWebhookPost(billingEvent())
        ->assertOk();

    Queue::assertPushed(ProcessStripeBillingWebhookJob::class);
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

test('same event id sent twice dispatches job only once', function () {
    $eventId    = 'evt_idem_billing_' . uniqid();
    $customerId = 'cus_idem_' . uniqid();
    $org        = billingOrgWithCustomer($customerId);

    Subscription::factory()->forOrganization($org->id)->starter()->active()->create([
        'stripe_subscription_id' => 'sub_idem_' . uniqid(),
    ]);

    $event = billingEvent([
        'id'   => $eventId,
        'type' => 'invoice.payment_failed',
        'data' => ['object' => [
            'id'                   => 'in_idem',
            'customer'             => $customerId,
            'attempt_count'        => 1,
            'next_payment_attempt' => null,
        ]],
    ]);

    // First request — job runs (sync queue), cache entry stored.
    billingWebhookPost($event)->assertOk();

    // Second request with same event id — cache hit, 200 but no re-dispatch.
    // Use Queue::fake only for the second call so we can assert it was NOT pushed.
    Queue::fake();
    billingWebhookPost($event)->assertOk();
    Queue::assertNothingPushed();
});

// ─── Job dispatch carries correct event type ─────────────────────────────────

test('customer.subscription.updated dispatches job with correct event type', function () {
    Queue::fake();

    $event = billingEvent([
        'type' => 'customer.subscription.updated',
        'data' => ['object' => [
            'id'       => 'sub_dispatch_test',
            'customer' => 'cus_dispatch_test',
            'status'   => 'active',
        ]],
    ]);

    billingWebhookPost($event)->assertOk();

    Queue::assertPushed(ProcessStripeBillingWebhookJob::class, function ($job) use ($event) {
        $data = (fn() => $this->eventData)->call($job);
        return ($data['type'] ?? null) === 'customer.subscription.updated'
            && ($data['id'] ?? null) === $event['id'];
    });
});

test('invoice.upcoming event dispatches job', function () {
    Queue::fake();

    billingWebhookPost(billingEvent(['type' => 'invoice.upcoming']))->assertOk();

    Queue::assertPushed(ProcessStripeBillingWebhookJob::class);
});

// ─── invoice.upcoming job creates renewal reminder notification ───────────────

test('invoice.upcoming job creates in-app notification for org', function () {
    $customerId = 'cus_upcoming_' . uniqid();
    $org        = billingOrgWithCustomer($customerId);

    $renewalTs = now()->addMonth()->timestamp;

    $event = billingEvent([
        'type' => 'invoice.upcoming',
        'data' => ['object' => [
            'customer'        => $customerId,
            'subscription'    => 'sub_upcoming_test',
            'amount_due'      => 4900,
            'period_end'      => $renewalTs,
        ]],
    ]);

    // Queue is sync in test env — job runs immediately.
    billingWebhookPost($event)->assertOk();

    $this->assertDatabaseHas('notifications', [
        'organization_id'   => $org->id,
        'notification_type' => 'reminder',
        'title'             => 'Your subscription renews soon',
    ]);
});

test('invoice.upcoming job writes billing.renewal_reminder_sent audit log', function () {
    $customerId = 'cus_upcoming_audit_' . uniqid();
    $org        = billingOrgWithCustomer($customerId);

    $event = billingEvent([
        'type' => 'invoice.upcoming',
        'data' => ['object' => [
            'customer'     => $customerId,
            'subscription' => 'sub_audit_test',
            'amount_due'   => 4900,
            'period_end'   => now()->addMonth()->timestamp,
        ]],
    ]);

    billingWebhookPost($event)->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'action'          => 'billing.renewal_reminder_sent',
    ]);
});

test('invoice.upcoming for unknown customer returns 200 without notification', function () {
    $event = billingEvent([
        'type' => 'invoice.upcoming',
        'data' => ['object' => [
            'customer'     => 'cus_nonexistent_' . uniqid(),
            'subscription' => 'sub_nonexistent',
            'amount_due'   => 4900,
            'period_end'   => now()->addMonth()->timestamp,
        ]],
    ]);

    billingWebhookPost($event)->assertOk();

    expect(Notification::count())->toBe(0);
});
