<?php

use App\Jobs\ProcessStripeBillingWebhookJob;
use App\Jobs\ProcessStripeConnectWebhookJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function legacyPost(string $url, array $payload = []): \Illuminate\Testing\TestResponse
{
    return test()->call(
        'POST',
        $url,
        [], [], [],
        ['CONTENT_TYPE' => 'application/json'],
        json_encode(array_merge(['id' => 'evt_legacy_' . uniqid(), 'type' => 'invoice.upcoming'], $payload)),
    );
}

// ─── POST /api/v1/billing/webhook ────────────────────────────────────────────

test('POST /api/v1/billing/webhook returns 200', function () {
    legacyPost('/api/v1/billing/webhook')->assertOk();
});

test('POST /api/v1/billing/webhook response contains Deprecated', function () {
    $response = legacyPost('/api/v1/billing/webhook');

    expect($response->getContent())->toContain('Deprecated');
});

test('POST /api/v1/billing/webhook does not dispatch ProcessStripeBillingWebhookJob', function () {
    Queue::fake();

    legacyPost('/api/v1/billing/webhook');

    Queue::assertNotPushed(ProcessStripeBillingWebhookJob::class);
});

test('POST /api/v1/billing/webhook does not dispatch ProcessStripeConnectWebhookJob', function () {
    Queue::fake();

    legacyPost('/api/v1/billing/webhook');

    Queue::assertNotPushed(ProcessStripeConnectWebhookJob::class);
});

// ─── POST /api/v1/stripe/webhook ─────────────────────────────────────────────

test('POST /api/v1/stripe/webhook returns 200', function () {
    legacyPost('/api/v1/stripe/webhook')->assertOk();
});

test('POST /api/v1/stripe/webhook response contains Deprecated', function () {
    $response = legacyPost('/api/v1/stripe/webhook');

    expect($response->getContent())->toContain('Deprecated');
});

test('POST /api/v1/stripe/webhook does not dispatch ProcessStripeBillingWebhookJob', function () {
    Queue::fake();

    legacyPost('/api/v1/stripe/webhook');

    Queue::assertNotPushed(ProcessStripeBillingWebhookJob::class);
});

test('POST /api/v1/stripe/webhook does not dispatch ProcessStripeConnectWebhookJob', function () {
    Queue::fake();

    legacyPost('/api/v1/stripe/webhook');

    Queue::assertNotPushed(ProcessStripeConnectWebhookJob::class);
});

// ─── Legacy routes accept any payload without signature check ─────────────────

test('POST /api/v1/billing/webhook returns 200 even with no Stripe-Signature header', function () {
    test()->call(
        'POST',
        '/api/v1/billing/webhook',
        [], [], [],
        ['CONTENT_TYPE' => 'application/json'],
        json_encode(['id' => 'evt_nosig', 'type' => 'checkout.session.completed']),
    )->assertOk();
});

test('POST /api/v1/stripe/webhook returns 200 even with no Stripe-Signature header', function () {
    test()->call(
        'POST',
        '/api/v1/stripe/webhook',
        [], [], [],
        ['CONTENT_TYPE' => 'application/json'],
        json_encode(['id' => 'evt_nosig', 'type' => 'customer.subscription.deleted']),
    )->assertOk();
});
