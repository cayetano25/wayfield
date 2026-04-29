<?php

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\PaymentIntentRecord;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * POST to the Connect webhook endpoint. Clears the connect webhook secret so
 * the controller uses the no-signature path available in the testing environment.
 */
function connectPost(array $payload): \Illuminate\Testing\TestResponse
{
    config(['stripe.connect_webhook_secret' => null]);

    return test()->call(
        'POST',
        '/api/webhooks/stripe/connect',
        [], [], [],
        ['CONTENT_TYPE' => 'application/json'],
        json_encode($payload),
    );
}

function connectPaymentEvent(string $type, string $paymentIntentId, array $extra = []): array
{
    return [
        'id'       => 'evt_connect_' . uniqid(),
        'type'     => $type,
        'livemode' => false,
        'data'     => [
            'object' => array_merge(['id' => $paymentIntentId], $extra),
        ],
    ];
}

function connectPayoutEvent(string $stripeAccountId, array $payoutFields = []): array
{
    return [
        'id'      => 'evt_payout_' . uniqid(),
        'type'    => 'payout.paid',
        'livemode' => false,
        'account' => $stripeAccountId,
        'data'    => [
            'object' => array_merge([
                'id'           => 'po_test_' . uniqid(),
                'amount'       => 7500,
                'currency'     => 'usd',
                'arrival_date' => now()->addDays(2)->timestamp,
            ], $payoutFields),
        ],
    ];
}

function makeOrder(string $stripePaymentIntentId, string $status = 'pending'): array
{
    $user = User::factory()->create();
    $org  = Organization::factory()->create();

    $order = Order::create([
        'order_number'             => 'ORD-' . strtoupper(uniqid()),
        'user_id'                  => $user->id,
        'organization_id'          => $org->id,
        'stripe_payment_intent_id' => $stripePaymentIntentId,
        'status'                   => $status,
    ]);

    PaymentIntentRecord::create([
        'order_id'                 => $order->id,
        'stripe_payment_intent_id' => $stripePaymentIntentId,
        'stripe_account_id'        => 'acct_test_' . uniqid(),
        'amount_cents'             => 10000,
        'currency'                 => 'usd',
        'status'                   => 'requires_payment_method',
    ]);

    return [$order, $user, $org];
}

function makeConnectAccount(string $stripeAccountId): array
{
    $org = Organization::factory()->create();

    $account = StripeConnectAccount::create([
        'organization_id'   => $org->id,
        'stripe_account_id' => $stripeAccountId,
        'onboarding_status' => 'complete',
        'charges_enabled'   => true,
        'payouts_enabled'   => true,
        'details_submitted' => true,
        'country'           => 'US',
        'default_currency'  => 'usd',
    ]);

    return [$org, $account];
}

// ─── payment_intent.processing ───────────────────────────────────────────────

test('payment_intent.processing updates order status to processing', function () {
    $pi = 'pi_proc_' . uniqid();
    [$order] = makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.processing', $pi))->assertOk();

    $order->refresh();
    expect($order->status)->toBe('processing');
});

test('payment_intent.processing updates PaymentIntentRecord status', function () {
    $pi = 'pi_proc_record_' . uniqid();
    makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.processing', $pi))->assertOk();

    expect(
        PaymentIntentRecord::where('stripe_payment_intent_id', $pi)->value('status')
    )->toBe('processing');
});

test('payment_intent.processing on already-completed order does not change status', function () {
    $pi = 'pi_proc_completed_' . uniqid();
    [$order] = makeOrder($pi, 'completed');

    connectPost(connectPaymentEvent('payment_intent.processing', $pi))->assertOk();

    $order->refresh();
    expect($order->status)->toBe('completed');
});

test('payment_intent.processing for unknown intent is a graceful no-op', function () {
    connectPost(connectPaymentEvent('payment_intent.processing', 'pi_unknown_' . uniqid()))
        ->assertOk();
});

// ─── payment_intent.canceled ─────────────────────────────────────────────────

test('payment_intent.canceled updates order status to cancelled', function () {
    $pi = 'pi_cancel_' . uniqid();
    [$order] = makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.canceled', $pi, ['cancellation_reason' => 'abandoned']))
        ->assertOk();

    $order->refresh();
    expect($order->status)->toBe('cancelled');
    expect($order->cancelled_at)->not->toBeNull();
    expect($order->cancellation_reason)->toContain('abandoned');
});

test('payment_intent.canceled on completed order does not change status', function () {
    $pi = 'pi_cancel_done_' . uniqid();
    [$order] = makeOrder($pi, 'completed');

    connectPost(connectPaymentEvent('payment_intent.canceled', $pi))->assertOk();

    $order->refresh();
    expect($order->status)->toBe('completed');
});

test('payment_intent.canceled writes audit log entry', function () {
    $pi = 'pi_cancel_audit_' . uniqid();
    [$order, , $org] = makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.canceled', $pi))->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'entity_type'     => 'order',
        'entity_id'       => $order->id,
        'action'          => 'payment.order_cancelled',
    ]);
});

// ─── payment_intent.requires_action ──────────────────────────────────────────

test('payment_intent.requires_action updates PaymentIntentRecord status', function () {
    $pi = 'pi_ra_' . uniqid();
    makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.requires_action', $pi, [
        'next_action' => ['type' => 'use_stripe_sdk'],
    ]))->assertOk();

    expect(
        PaymentIntentRecord::where('stripe_payment_intent_id', $pi)->value('status')
    )->toBe('requires_action');
});

test('payment_intent.requires_action creates in-app notification for participant', function () {
    $pi = 'pi_ra_notif_' . uniqid();
    [$order, , $org] = makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.requires_action', $pi))->assertOk();

    $this->assertDatabaseHas('notifications', [
        'organization_id'   => $org->id,
        'notification_type' => 'urgent',
        'title'             => 'Payment action required',
    ]);
});

test('payment_intent.requires_action creates ScheduledPaymentJob for 2-hour reminder', function () {
    $pi = 'pi_ra_sched_' . uniqid();
    [$order] = makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.requires_action', $pi))->assertOk();

    $job = ScheduledPaymentJob::where('job_type', 'payment_requires_action_reminder')
        ->where('related_entity_type', 'order')
        ->where('related_entity_id', $order->id)
        ->first();

    expect($job)->not->toBeNull();
    expect($job->scheduled_for->isAfter(now()->addMinutes(90)))->toBeTrue();
    expect($job->status)->toBe('pending');
});

test('payment_intent.requires_action writes audit log entry', function () {
    $pi = 'pi_ra_audit_' . uniqid();
    [$order, , $org] = makeOrder($pi, 'pending');

    connectPost(connectPaymentEvent('payment_intent.requires_action', $pi))->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'action'          => 'payment.requires_action',
    ]);
});

test('payment_intent.requires_action on completed order is a no-op', function () {
    $pi = 'pi_ra_done_' . uniqid();
    makeOrder($pi, 'completed');

    connectPost(connectPaymentEvent('payment_intent.requires_action', $pi))->assertOk();

    expect(
        PaymentIntentRecord::where('stripe_payment_intent_id', $pi)->value('status')
    )->toBe('requires_payment_method');

    expect(
        ScheduledPaymentJob::where('job_type', 'payment_requires_action_reminder')->count()
    )->toBe(0);
});

// ─── payout.paid ─────────────────────────────────────────────────────────────

test('payout.paid creates in-app notification for org', function () {
    $stripeAccountId = 'acct_payout_' . uniqid();
    [$org] = makeConnectAccount($stripeAccountId);

    connectPost(connectPayoutEvent($stripeAccountId))->assertOk();

    $this->assertDatabaseHas('notifications', [
        'organization_id'   => $org->id,
        'notification_type' => 'informational',
        'title'             => 'Payout on its way',
    ]);
});

test('payout.paid notification message contains amount and currency', function () {
    $stripeAccountId = 'acct_payout_amt_' . uniqid();
    [$org] = makeConnectAccount($stripeAccountId);

    connectPost(connectPayoutEvent($stripeAccountId, ['amount' => 12500, 'currency' => 'usd']))
        ->assertOk();

    $notification = Notification::where('organization_id', $org->id)
        ->where('title', 'Payout on its way')
        ->first();

    expect($notification)->not->toBeNull();
    expect($notification->message)->toContain('125.00');
    expect($notification->message)->toContain('usd');
});

test('payout.paid writes audit log entry', function () {
    $stripeAccountId = 'acct_payout_audit_' . uniqid();
    [$org, $account] = makeConnectAccount($stripeAccountId);

    connectPost(connectPayoutEvent($stripeAccountId))->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'entity_type'     => 'stripe_connect_account',
        'entity_id'       => $account->id,
        'action'          => 'stripe_connect.payout_paid',
    ]);
});

test('payout.paid for unknown Stripe account is a graceful no-op', function () {
    connectPost(connectPayoutEvent('acct_unknown_' . uniqid()))->assertOk();

    expect(Notification::count())->toBe(0);
});
