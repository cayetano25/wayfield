<?php

use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Services\StripeConnectService;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\StripeEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function connectOrg(string $role = 'owner', bool $paymentsEnabled = true): array
{
    $org  = Organization::factory()->create(['primary_contact_email' => 'contact@example.com']);
    $user = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => $role,
        'is_active'       => true,
    ]);

    if ($paymentsEnabled) {
        enableOrgPayments($org);
    }

    return [$org, $user];
}

function enableOrgPayments(Organization $org): PaymentFeatureFlag
{
    // Platform flag must be active first.
    PaymentFeatureFlag::create([
        'scope'    => 'platform',
        'flag_key' => 'payments_enabled',
        'is_enabled' => true,
    ]);

    return PaymentFeatureFlag::create([
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
        'enabled_at'      => now(),
    ]);
}

function mockConnectService(string $fakeAccountId = 'acct_test123', string $fakeLinkUrl = 'https://connect.stripe.com/test'): void
{
    $mock = Mockery::mock(StripeConnectService::class);

    $mock->shouldReceive('createConnectAccount')
        ->andReturnUsing(function ($org, $user) use ($fakeAccountId) {
            return StripeConnectAccount::create([
                'organization_id'   => $org->id,
                'stripe_account_id' => $fakeAccountId,
                'onboarding_status' => 'initiated',
                'charges_enabled'   => false,
                'payouts_enabled'   => false,
                'details_submitted' => false,
                'country'           => 'US',
                'default_currency'  => 'usd',
            ]);
        });

    $mock->shouldReceive('createAccountLink')
        ->andReturn($fakeLinkUrl);

    app()->instance(StripeConnectService::class, $mock);
}

// ─── POST /stripe/connect ────────────────────────────────────────────────────

test('owner can initiate connect onboarding', function () {
    Mail::fake();
    [$org, $user] = connectOrg('owner');
    mockConnectService();

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/connect");

    $response->assertStatus(201)
        ->assertJsonPath('data.stripe_account_id', 'acct_test123')
        ->assertJsonPath('data.onboarding_status', 'initiated')
        ->assertJsonStructure(['data' => ['stripe_account_id', 'onboarding_status', 'account_link_url']]);

    expect(StripeConnectAccount::where('organization_id', $org->id)->exists())->toBeTrue();
});

test('admin can initiate connect onboarding', function () {
    Mail::fake();
    [$org, $user] = connectOrg('admin');
    mockConnectService();

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/connect")
        ->assertStatus(201);
});

test('staff cannot initiate connect onboarding', function () {
    [$org, $user] = connectOrg('staff');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/connect")
        ->assertStatus(403);
});

test('billing_admin cannot initiate connect onboarding', function () {
    [$org, $user] = connectOrg('billing_admin');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/connect")
        ->assertStatus(403);
});

test('initiate returns 403 when org payments not enabled', function () {
    // Platform payments are globally enabled but org flag is missing.
    $org  = Organization::factory()->create(['primary_contact_email' => 'x@example.com']);
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    PaymentFeatureFlag::create([
        'scope'      => 'platform',
        'flag_key'   => 'payments_enabled',
        'is_enabled' => true,
    ]);
    // org_payments_enabled flag deliberately NOT created.

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/connect")
        ->assertStatus(403)
        ->assertJsonPath('error', 'payments_not_enabled');
});

test('initiate returns 409 when connect account already exists', function () {
    [$org, $user] = connectOrg('owner');

    StripeConnectAccount::create([
        'organization_id'   => $org->id,
        'stripe_account_id' => 'acct_existing',
        'onboarding_status' => 'pending',
        'charges_enabled'   => false,
        'payouts_enabled'   => false,
        'details_submitted' => true,
        'country'           => 'US',
        'default_currency'  => 'usd',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/connect")
        ->assertStatus(409)
        ->assertJsonPath('error', 'already_connected');
});

test('unauthenticated request is rejected', function () {
    $org = Organization::factory()->create();

    $this->postJson("/api/v1/organizations/{$org->id}/stripe/connect")
        ->assertStatus(401);
});

// ─── POST /stripe/refresh-link ───────────────────────────────────────────────

test('owner can refresh an expired account link', function () {
    [$org, $user] = connectOrg('owner');
    mockConnectService('acct_test123', 'https://connect.stripe.com/refreshed');

    StripeConnectAccount::create([
        'organization_id'   => $org->id,
        'stripe_account_id' => 'acct_test123',
        'onboarding_status' => 'initiated',
        'charges_enabled'   => false,
        'payouts_enabled'   => false,
        'details_submitted' => false,
        'country'           => 'US',
        'default_currency'  => 'usd',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/refresh-link")
        ->assertOk()
        ->assertJsonPath('data.account_link_url', 'https://connect.stripe.com/refreshed');
});

test('refresh-link returns 404 when no account exists', function () {
    [$org, $user] = connectOrg('owner');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/refresh-link")
        ->assertStatus(404);
});

test('refresh-link returns 422 when onboarding is already complete', function () {
    [$org, $user] = connectOrg('owner');

    StripeConnectAccount::create([
        'organization_id'    => $org->id,
        'stripe_account_id'  => 'acct_test123',
        'onboarding_status'  => 'complete',
        'charges_enabled'    => true,
        'payouts_enabled'    => true,
        'details_submitted'  => true,
        'onboarding_completed_at' => now(),
        'country'            => 'US',
        'default_currency'   => 'usd',
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/refresh-link")
        ->assertStatus(422);
});

test('staff cannot refresh an account link', function () {
    [$org, $user] = connectOrg('staff');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/stripe/refresh-link")
        ->assertStatus(403);
});

// ─── GET /stripe/status ───────────────────────────────────────────────────────

test('owner can view stripe status', function () {
    [$org, $user] = connectOrg('owner');

    StripeConnectAccount::create([
        'organization_id'   => $org->id,
        'stripe_account_id' => 'acct_status',
        'onboarding_status' => 'pending',
        'charges_enabled'   => false,
        'payouts_enabled'   => false,
        'details_submitted' => true,
        'country'           => 'US',
        'default_currency'  => 'usd',
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/stripe/status")
        ->assertOk()
        ->assertJsonPath('data.connected', true)
        ->assertJsonPath('data.onboarding_status', 'pending')
        ->assertJsonPath('data.payments_enabled_for_org', true)
        ->assertJsonStructure(['data' => [
            'connected', 'charges_enabled', 'payouts_enabled',
            'onboarding_status', 'details_submitted', 'requirements',
            'payments_enabled_for_org',
        ]]);
});

test('staff can view stripe status', function () {
    [$org, $user] = connectOrg('staff');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/stripe/status")
        ->assertOk();
});

test('billing_admin cannot view stripe status', function () {
    [$org, $user] = connectOrg('billing_admin');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/stripe/status")
        ->assertStatus(403);
});

test('status returns connected=false when no account', function () {
    [$org, $user] = connectOrg('owner');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/stripe/status")
        ->assertOk()
        ->assertJsonPath('data.connected', false);
});
