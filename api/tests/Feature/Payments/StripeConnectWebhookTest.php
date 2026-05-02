<?php

use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Services\StripeConnectService;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\StripeEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function connectWebhookPost(array $payload): \Illuminate\Testing\TestResponse
{
    $secret = 'whsec_connect_test_' . uniqid();
    config(['stripe.connect_webhook_secret' => $secret]);

    $json      = json_encode($payload);
    $timestamp = time();
    $sig       = hash_hmac('sha256', "{$timestamp}.{$json}", $secret);
    $header    = "t={$timestamp},v1={$sig}";

    return test()->call(
        'POST',
        '/api/webhooks/stripe/connect',
        [],
        [],
        [],
        ['HTTP_Stripe-Signature' => $header, 'CONTENT_TYPE' => 'application/json'],
        $json,
    );
}

function connectOrgWithAccount(string $status = 'initiated', bool $chargesEnabled = false, bool $payoutsEnabled = false): array
{
    $org  = Organization::factory()->create(['primary_contact_email' => 'test@example.com']);
    $user = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    $account = StripeConnectAccount::create([
        'organization_id'   => $org->id,
        'stripe_account_id' => 'acct_test_wh',
        'onboarding_status' => $status,
        'charges_enabled'   => $chargesEnabled,
        'payouts_enabled'   => $payoutsEnabled,
        'details_submitted' => false,
        'country'           => 'US',
        'default_currency'  => 'usd',
    ]);

    return [$org, $user, $account];
}

// ─── Webhook signature verification ──────────────────────────────────────────

test('connect webhook rejects invalid signature', function () {
    $secret = 'whsec_real_secret';
    config(['stripe.connect_webhook_secret' => $secret]);

    test()->call(
        'POST',
        '/api/webhooks/stripe/connect',
        [],
        [],
        [],
        ['HTTP_Stripe-Signature' => 't=1,v1=invalidsig', 'CONTENT_TYPE' => 'application/json'],
        json_encode(['id' => 'evt_bad', 'type' => 'account.updated']),
    )->assertStatus(400);
});

test('connect webhook returns 200 immediately and dispatches job', function () {
    Queue::fake();
    [, , $account] = connectOrgWithAccount();

    $payload = [
        'id'      => 'evt_test_dispatch_' . uniqid(),
        'type'    => 'account.updated',
        'livemode' => false,
        'account' => 'acct_test_wh',
        'data'    => ['object' => ['id' => 'acct_test_wh', 'charges_enabled' => false, 'payouts_enabled' => false, 'details_submitted' => false]],
    ];

    connectWebhookPost($payload)->assertOk()->assertJsonPath('received', true);

    expect(StripeEvent::where('stripe_event_id', $payload['id'])->exists())->toBeTrue();
    Queue::assertPushed(\App\Jobs\ProcessStripeConnectWebhookJob::class);
});

test('duplicate connect webhook event is not re-queued', function () {
    Queue::fake();
    [, , $account] = connectOrgWithAccount();

    $eventId = 'evt_dup_' . uniqid();
    // Insert as already processed
    StripeEvent::create([
        'stripe_event_id' => $eventId,
        'event_type'      => 'account.updated',
        'livemode'        => false,
        'payload_json'    => ['id' => $eventId],
        'processed_at'    => now(),
    ]);

    connectWebhookPost(['id' => $eventId, 'type' => 'account.updated', 'livemode' => false, 'data' => ['object' => []]])
        ->assertOk();

    Queue::assertNotPushed(\App\Jobs\ProcessStripeConnectWebhookJob::class);
});

// ─── StripeConnectService::handleAccountUpdatedWebhook ───────────────────────

test('account.updated sets charges_enabled and payouts_enabled on account', function () {
    [, , $account] = connectOrgWithAccount();

    $service = app(StripeConnectService::class);
    $service->handleAccountUpdatedWebhook([
        'data' => [
            'object' => [
                'id'               => 'acct_test_wh',
                'charges_enabled'  => true,
                'payouts_enabled'  => false,
                'details_submitted' => true,
                'capabilities'     => ['transfers' => 'active'],
                'requirements'     => ['currently_due' => []],
            ],
        ],
    ]);

    $account->refresh();
    expect($account->charges_enabled)->toBeTrue();
    expect($account->details_submitted)->toBeTrue();
    expect($account->payouts_enabled)->toBeFalse();
    expect($account->last_webhook_received_at)->not->toBeNull();
});

test('account.updated marks onboarding complete when both capabilities enabled', function () {
    Mail::fake();
    [$org, , $account] = connectOrgWithAccount('pending');

    $pendingJob = ScheduledPaymentJob::create([
        'job_type'            => 'stripe_onboarding_incomplete_reminder',
        'related_entity_type' => 'stripe_connect_account',
        'related_entity_id'   => $account->id,
        'scheduled_for'       => now()->addDays(3),
        'status'              => 'pending',
    ]);

    $service = app(StripeConnectService::class);
    $service->handleAccountUpdatedWebhook([
        'data' => [
            'object' => [
                'id'               => 'acct_test_wh',
                'charges_enabled'  => true,
                'payouts_enabled'  => true,
                'details_submitted' => true,
                'capabilities'     => ['transfers' => 'active'],
                'requirements'     => ['currently_due' => []],
            ],
        ],
    ]);

    $account->refresh();
    expect($account->onboarding_status)->toBe('complete');
    expect($account->onboarding_completed_at)->not->toBeNull();

    $pendingJob->refresh();
    expect($pendingJob->status)->toBe('cancelled');

    // Audit log written
    expect(AuditLog::where('action', 'stripe_connect.onboarding_completed')->exists())->toBeTrue();
});

test('account.updated does not re-complete already complete account', function () {
    Mail::fake();
    [$org, , $account] = connectOrgWithAccount('complete', chargesEnabled: true, payoutsEnabled: true);

    $completedAt = now()->subHour();
    $account->update(['onboarding_completed_at' => $completedAt]);

    $service = app(StripeConnectService::class);
    $service->handleAccountUpdatedWebhook([
        'data' => [
            'object' => [
                'id'               => 'acct_test_wh',
                'charges_enabled'  => true,
                'payouts_enabled'  => true,
                'details_submitted' => true,
                'capabilities'     => [],
                'requirements'     => ['currently_due' => []],
            ],
        ],
    ]);

    // No duplicate audit log
    expect(AuditLog::where('action', 'stripe_connect.onboarding_completed')->count())->toBe(0);
    Mail::assertNothingQueued();
});

// ─── StripeConnectService::handleAccountDeauthorizedWebhook ──────────────────

test('account.application.deauthorized marks account deauthorized and notifies admins', function () {
    Mail::fake();
    [$org, , $account] = connectOrgWithAccount('complete', chargesEnabled: true, payoutsEnabled: true);

    $service = app(StripeConnectService::class);
    $service->handleAccountDeauthorizedWebhook([
        'data' => ['object' => ['id' => 'acct_test_wh']],
    ]);

    $account->refresh();
    expect($account->onboarding_status)->toBe('deauthorized');
    expect($account->deauthorized_at)->not->toBeNull();

    expect(AuditLog::where('action', 'stripe_connect.account_deauthorized')->exists())->toBeTrue();
    Mail::assertQueued(\App\Mail\Payments\StripeConnectDeauthorizedMail::class);
});

// ─── StripeConnectService::handlePayoutFailedWebhook ─────────────────────────

test('payout.failed logs audit entry and emails org admins', function () {
    Mail::fake();
    [$org, , $account] = connectOrgWithAccount('complete', chargesEnabled: true, payoutsEnabled: true);

    $service = app(StripeConnectService::class);
    $service->handlePayoutFailedWebhook([
        'account' => 'acct_test_wh',
        'data'    => [
            'object' => [
                'id'              => 'po_test',
                'amount'          => 5000,
                'currency'        => 'usd',
                'failure_message' => 'Account cannot accept payments in this currency.',
                'failure_code'    => 'account_closed',
            ],
        ],
    ]);

    expect(AuditLog::where('action', 'stripe_connect.payout_failed')->exists())->toBeTrue();
    Mail::assertQueued(\App\Mail\Payments\StripeConnectPayoutFailedMail::class);
});

// ─── StripeConnectService::handleCapabilityUpdatedWebhook ────────────────────

test('capability.updated inactive with past_due requirements emails org admins', function () {
    Mail::fake();
    [$org, , $account] = connectOrgWithAccount('complete', chargesEnabled: true, payoutsEnabled: true);

    $service = app(StripeConnectService::class);
    $service->handleCapabilityUpdatedWebhook([
        'data' => [
            'object' => [
                'id'       => 'transfers',
                'account'  => 'acct_test_wh',
                'status'   => 'inactive',
                'requirements' => [
                    'currently_due' => [],
                    'past_due'      => ['individual.verification.document'],
                ],
            ],
        ],
    ]);

    expect(AuditLog::where('action', 'stripe_connect.verification_required')->exists())->toBeTrue();
    Mail::assertQueued(\App\Mail\Payments\StripeConnectVerificationRequiredMail::class);
});

test('capability.updated active status does not trigger verification email', function () {
    Mail::fake();
    connectOrgWithAccount('complete', chargesEnabled: true, payoutsEnabled: true);

    $service = app(StripeConnectService::class);
    $service->handleCapabilityUpdatedWebhook([
        'data' => [
            'object' => [
                'id'       => 'transfers',
                'account'  => 'acct_test_wh',
                'status'   => 'active',
                'requirements' => ['currently_due' => []],
            ],
        ],
    ]);

    Mail::assertNothingQueued();
});

// ─── Platform admin: enable/disable payments ─────────────────────────────────

test('platform admin can enable payments for an org', function () {
    Mail::fake();
    $org      = Organization::factory()->create();
    // Org needs at least one owner/admin to receive the N-47 email.
    $orgOwner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $orgOwner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $adminUser = \App\Models\AdminUser::factory()->create(['role' => 'admin']);

    $this->actingAs($adminUser, 'platform_admin')
        ->postJson("/api/platform/v1/organizations/{$org->id}/enable-payments")
        ->assertOk()
        ->assertJsonPath('data.org_payments_enabled', true);

    expect(
        PaymentFeatureFlag::where('organization_id', $org->id)
            ->where('flag_key', 'org_payments_enabled')
            ->where('is_enabled', true)
            ->exists()
    )->toBeTrue();

    expect(AuditLog::where('action', 'org_payments_enabled')->exists())->toBeTrue();
    Mail::assertQueued(\App\Mail\Payments\PaymentsEnabledForOrgMail::class);
});

test('platform admin can disable payments for an org', function () {
    $org = Organization::factory()->create();
    PaymentFeatureFlag::create([
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
        'enabled_at'      => now(),
    ]);

    $adminUser = \App\Models\AdminUser::factory()->create(['role' => 'admin']);

    $this->actingAs($adminUser, 'platform_admin')
        ->postJson("/api/platform/v1/organizations/{$org->id}/disable-payments")
        ->assertOk()
        ->assertJsonPath('data.org_payments_enabled', false);

    expect(
        PaymentFeatureFlag::where('organization_id', $org->id)
            ->where('flag_key', 'org_payments_enabled')
            ->where('is_enabled', false)
            ->exists()
    )->toBeTrue();

    expect(AuditLog::where('action', 'org_payments_disabled')->exists())->toBeTrue();
});

test('tenant user cannot call platform payment endpoints', function () {
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    // A regular (tenant) user hits a platform-admin-only route.
    // The platform.admin middleware rejects with 403 (not a platform admin token).
    $this->actingAs($user)
        ->postJson("/api/platform/v1/organizations/{$org->id}/enable-payments")
        ->assertStatus(403);
});
