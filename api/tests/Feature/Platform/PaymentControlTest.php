<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function payAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Pay',
        'last_name'     => "Admin{$seq}",
        'email'         => "payadmin{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function payToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function seedTakeRates(): void
{
    $rates = [
        ['plan_code' => 'foundation', 'take_rate_pct' => 0.0650],
        ['plan_code' => 'creator',    'take_rate_pct' => 0.0400],
        ['plan_code' => 'studio',     'take_rate_pct' => 0.0200],
        ['plan_code' => 'custom',     'take_rate_pct' => 0.0200],
    ];
    foreach ($rates as $r) {
        DB::table('platform_take_rates')->insertOrIgnore(
            $r + ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]
        );
    }
}

function seedPlatformPaymentFlag(bool $enabled = false): void
{
    DB::table('payment_feature_flags')->updateOrInsert(
        ['scope' => 'platform', 'flag_key' => 'payments_enabled'],
        [
            'organization_id' => null,
            'is_enabled'      => $enabled,
            'enabled_at'      => $enabled ? now() : null,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]
    );
}

// ─── GET /payments/status ─────────────────────────────────────────────────────

test('GET /payments/status returns 200 with correct shape', function () {
    $admin = payAdmin();
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/status')
        ->assertStatus(200)
        ->assertJsonStructure([
            'platform_payments_enabled',
            'enabled_at',
            'orgs_payment_enabled_count',
            'orgs_stripe_connected_count',
            'orgs_stripe_charges_enabled_count',
            'warning',
        ])
        ->assertJsonPath('platform_payments_enabled', false);
});

test('GET /payments/status platform_payments_enabled is boolean', function () {
    $admin = payAdmin();
    seedPlatformPaymentFlag(true);

    $response = $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/status')
        ->assertStatus(200);

    expect($response->json('platform_payments_enabled'))->toBeBool();
});

test('GET /payments/status warning is set when orgs enabled but platform is OFF', function () {
    $admin = payAdmin();
    $org   = Organization::factory()->create();

    seedPlatformPaymentFlag(false);

    DB::table('payment_feature_flags')->insert([
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
        'enabled_at'      => now(),
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/status')
        ->assertStatus(200)
        ->assertJsonPath('orgs_payment_enabled_count', 1)
        ->assertJsonPath('platform_payments_enabled', false)
        ->assertJsonFragment(['warning' => '1 organisation(s) have payments enabled but the global platform payments switch is OFF — they cannot process payments.']);
});

// ─── POST /payments/enable ────────────────────────────────────────────────────

test('POST /payments/enable with super_admin sets is_enabled=true and writes audit log', function () {
    $admin = payAdmin('super_admin');
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->postJson('/api/platform/v1/payments/enable')
        ->assertStatus(200)
        ->assertJsonPath('platform_payments_enabled', true);

    $this->assertDatabaseHas('payment_feature_flags', [
        'scope'      => 'platform',
        'flag_key'   => 'payments_enabled',
        'is_enabled' => true,
    ]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'platform_payments.enabled',
    ]);
});

test('POST /payments/enable with billing role returns 200', function () {
    $admin = payAdmin('billing');
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->postJson('/api/platform/v1/payments/enable')
        ->assertStatus(200)
        ->assertJsonPath('platform_payments_enabled', true);
});

test('POST /payments/enable with admin role returns 403', function () {
    $admin = payAdmin('admin');
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->postJson('/api/platform/v1/payments/enable')
        ->assertStatus(403);
});

test('POST /payments/enable with support role returns 403', function () {
    $admin = payAdmin('support');
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->postJson('/api/platform/v1/payments/enable')
        ->assertStatus(403);
});

// ─── POST /payments/disable ───────────────────────────────────────────────────

test('POST /payments/disable with super_admin sets is_enabled=false and writes audit log', function () {
    $admin = payAdmin('super_admin');
    seedPlatformPaymentFlag(true);

    $this->withToken(payToken($admin))
        ->postJson('/api/platform/v1/payments/disable')
        ->assertStatus(200)
        ->assertJsonPath('platform_payments_enabled', false);

    $this->assertDatabaseHas('payment_feature_flags', [
        'scope'      => 'platform',
        'flag_key'   => 'payments_enabled',
        'is_enabled' => false,
    ]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'platform_payments.disabled',
    ]);
});

// ─── Tenant token isolation ───────────────────────────────────────────────────

test('tenant token on GET /payments/status is rejected', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/payments/status')
        ->assertStatus(401);
});

test('tenant token on POST /payments/enable is rejected', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/platform/v1/payments/enable')
        ->assertStatus(401);
});

// ─── GET /organizations/{id}/payments ────────────────────────────────────────

test('GET /organizations/{id}/payments returns 200 with correct shape', function () {
    $admin = payAdmin();
    $org   = Organization::factory()->create();
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/payments")
        ->assertStatus(200)
        ->assertJsonStructure([
            'organization_id',
            'organization_name',
            'org_payments_enabled',
            'stripe_connect' => [
                'connected',
                'onboarding_status',
                'charges_enabled',
                'payouts_enabled',
                'details_submitted',
                'stripe_account_id',
                'last_webhook_received_at',
                'requirements',
            ],
            'flags' => [
                'deposits_enabled',
                'waitlist_payments',
            ],
            'effective_payments_active',
        ]);
});

test('GET /organizations/{id}/payments effective_payments_active is false when platform is OFF', function () {
    $admin = payAdmin();
    $org   = Organization::factory()->create();
    seedPlatformPaymentFlag(false);

    DB::table('payment_feature_flags')->insert([
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
        'enabled_at'      => now(),
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    $this->withToken(payToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/payments")
        ->assertStatus(200)
        ->assertJsonPath('effective_payments_active', false);
});

test('GET /organizations/{id}/payments effective_payments_active requires platform+org+charges', function () {
    $admin = payAdmin();
    $org   = Organization::factory()->create();
    seedPlatformPaymentFlag(true);

    DB::table('payment_feature_flags')->insert([
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
        'enabled_at'      => now(),
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    DB::table('stripe_connect_accounts')->insert([
        'organization_id'  => $org->id,
        'stripe_account_id'=> 'acct_test001',
        'onboarding_status'=> 'complete',
        'charges_enabled'  => true,
        'payouts_enabled'  => true,
        'details_submitted'=> true,
        'country'          => 'US',
        'default_currency' => 'usd',
        'created_at'       => now(),
        'updated_at'       => now(),
    ]);

    $this->withToken(payToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/payments")
        ->assertStatus(200)
        ->assertJsonPath('effective_payments_active', true)
        ->assertJsonPath('stripe_connect.connected', true)
        ->assertJsonPath('stripe_connect.charges_enabled', true);
});

// ─── POST /organizations/{id}/payments/enable ─────────────────────────────────

test('POST /organizations/{id}/payments/enable upserts flag and writes audit log', function () {
    $admin = payAdmin('super_admin');
    $org   = Organization::factory()->create();
    seedPlatformPaymentFlag(false);

    $this->withToken(payToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/payments/enable")
        ->assertStatus(200)
        ->assertJsonPath('org_payments_enabled', true);

    $this->assertDatabaseHas('payment_feature_flags', [
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
    ]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action'          => 'org_payments.enabled',
        'organization_id' => $org->id,
    ]);
});

// ─── POST /organizations/{id}/payments/disable ────────────────────────────────

test('POST /organizations/{id}/payments/disable upserts flag and writes audit log', function () {
    $admin = payAdmin('billing');
    $org   = Organization::factory()->create();
    seedPlatformPaymentFlag(false);

    DB::table('payment_feature_flags')->insert([
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'org_payments_enabled',
        'is_enabled'      => true,
        'enabled_at'      => now(),
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    $this->withToken(payToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/payments/disable")
        ->assertStatus(200)
        ->assertJsonPath('org_payments_enabled', false);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action'          => 'org_payments.disabled',
        'organization_id' => $org->id,
    ]);
});

// ─── PATCH /organizations/{id}/payments/flags/{flag_key} ─────────────────────

test('PATCH /organizations/{id}/payments/flags/deposits_enabled updates flag', function () {
    $admin = payAdmin('super_admin');
    $org   = Organization::factory()->create();

    $this->withToken(payToken($admin))
        ->patchJson("/api/platform/v1/organizations/{$org->id}/payments/flags/deposits_enabled", [
            'is_enabled' => true,
        ])
        ->assertStatus(200)
        ->assertJsonPath('flag_key', 'deposits_enabled')
        ->assertJsonPath('is_enabled', true);

    $this->assertDatabaseHas('payment_feature_flags', [
        'scope'           => 'organization',
        'organization_id' => $org->id,
        'flag_key'        => 'deposits_enabled',
        'is_enabled'      => true,
    ]);
});

test('PATCH /organizations/{id}/payments/flags/unknown_flag returns 422', function () {
    $admin = payAdmin('super_admin');
    $org   = Organization::factory()->create();

    $this->withToken(payToken($admin))
        ->patchJson("/api/platform/v1/organizations/{$org->id}/payments/flags/nonexistent_flag", [
            'is_enabled' => true,
        ])
        ->assertStatus(422);
});

// ─── GET /payments/take-rates ─────────────────────────────────────────────────

test('GET /payments/take-rates returns 200 with 4 rows', function () {
    $admin = payAdmin();
    seedTakeRates();

    $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/take-rates')
        ->assertStatus(200)
        ->assertJsonCount(4, 'data');
});

test('GET /payments/take-rates plan_codes use new names not old names', function () {
    $admin = payAdmin();
    seedTakeRates();

    $response = $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/take-rates')
        ->assertStatus(200);

    $planCodes = collect($response->json('data'))->pluck('plan_code')->toArray();

    expect($planCodes)->toContain('foundation')
        ->toContain('creator')
        ->toContain('studio')
        ->toContain('custom')
        ->not->toContain('free')
        ->not->toContain('starter')
        ->not->toContain('pro');
});

// ─── PATCH /payments/take-rates/{plan_code} ───────────────────────────────────

test('PATCH /payments/take-rates/creator with super_admin updates rate and writes audit log', function () {
    $admin = payAdmin('super_admin');
    seedTakeRates();

    $this->withToken(payToken($admin))
        ->patchJson('/api/platform/v1/payments/take-rates/creator', [
            'take_rate_pct' => 0.0350,
            'notes'         => 'Adjusted for Q2',
        ])
        ->assertStatus(200)
        ->assertJsonPath('plan_code', 'creator')
        ->assertJsonPath('take_rate_decimal', 0.035);

    $this->assertDatabaseHas('platform_take_rates', [
        'plan_code'     => 'creator',
        'take_rate_pct' => 0.0350,
    ]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action'      => 'take_rate.updated',
        'entity_type' => 'platform_take_rate',
    ]);
});

test('PATCH /payments/take-rates/creator with value 0.25 returns 422 (exceeds 20%)', function () {
    $admin = payAdmin('super_admin');
    seedTakeRates();

    $this->withToken(payToken($admin))
        ->patchJson('/api/platform/v1/payments/take-rates/creator', [
            'take_rate_pct' => 0.25,
        ])
        ->assertStatus(422);
});

test('PATCH /payments/take-rates/creator with billing role returns 403', function () {
    $admin = payAdmin('billing');
    seedTakeRates();

    $this->withToken(payToken($admin))
        ->patchJson('/api/platform/v1/payments/take-rates/creator', [
            'take_rate_pct' => 0.035,
        ])
        ->assertStatus(403);
});

test('PATCH /payments/take-rates/free returns 404 (old plan code does not exist)', function () {
    $admin = payAdmin('super_admin');
    seedTakeRates();

    $this->withToken(payToken($admin))
        ->patchJson('/api/platform/v1/payments/take-rates/free', [
            'take_rate_pct' => 0.05,
        ])
        ->assertStatus(404);
});

// ─── GET /payments/connect-accounts ──────────────────────────────────────────

test('GET /payments/connect-accounts returns 200 even when table is empty', function () {
    $admin = payAdmin();

    $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/connect-accounts')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'per_page', 'current_page', 'last_page'])
        ->assertJsonPath('total', 0);
});

test('GET /payments/connect-accounts?onboarding_status=pending filters results', function () {
    $admin = payAdmin();
    $org1  = Organization::factory()->create();
    $org2  = Organization::factory()->create();

    DB::table('stripe_connect_accounts')->insert([
        [
            'organization_id'  => $org1->id,
            'stripe_account_id'=> 'acct_pending001',
            'onboarding_status'=> 'pending',
            'charges_enabled'  => false,
            'payouts_enabled'  => false,
            'details_submitted'=> false,
            'country'          => 'US',
            'default_currency' => 'usd',
            'created_at'       => now(),
            'updated_at'       => now(),
        ],
        [
            'organization_id'  => $org2->id,
            'stripe_account_id'=> 'acct_complete001',
            'onboarding_status'=> 'complete',
            'charges_enabled'  => true,
            'payouts_enabled'  => true,
            'details_submitted'=> true,
            'country'          => 'US',
            'default_currency' => 'usd',
            'created_at'       => now(),
            'updated_at'       => now(),
        ],
    ]);

    $this->withToken(payToken($admin))
        ->getJson('/api/platform/v1/payments/connect-accounts?onboarding_status=pending')
        ->assertStatus(200)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.onboarding_status', 'pending');
});
