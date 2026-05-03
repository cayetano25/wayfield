<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ccAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'CC',
        'last_name'     => "Admin{$seq}",
        'email'         => "cc{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function ccToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function makeOrg(array $overrides = []): Organization
{
    return Organization::factory()->create($overrides);
}

// ─── GET /organizations — list ─────────────────────────────────────────────────

test('GET organizations returns paginated list', function () {
    $admin = ccAdmin();
    makeOrg();
    makeOrg();

    $this->withToken(ccToken($admin))
        ->getJson('/api/platform/v1/organizations')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'per_page']);
});

test('GET organizations requires authentication', function () {
    $this->getJson('/api/platform/v1/organizations')->assertStatus(401);
});

test('GET organizations is rejected with tenant token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/organizations')
        ->assertStatus(401);
});

test('GET organizations filters by search name', function () {
    $admin = ccAdmin();
    makeOrg(['name' => 'Photography Collective']);
    makeOrg(['name' => 'Dance Studio']);

    $response = $this->withToken(ccToken($admin))
        ->getJson('/api/platform/v1/organizations?search=Photography')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.name'))->toBe('Photography Collective');
});

test('GET organizations filters by plan', function () {
    $admin = ccAdmin();
    $org = makeOrg();
    $org->subscriptions()->create(['plan_code' => 'creator', 'status' => 'active', 'starts_at' => now()]);
    makeOrg(); // no subscription → free

    $response = $this->withToken(ccToken($admin))
        ->getJson('/api/platform/v1/organizations?plan=creator')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(1);
});

// ─── GET /organizations/{id} — detail ─────────────────────────────────────────

test('GET organization detail returns correct shape', function () {
    $admin = ccAdmin();
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}")
        ->assertStatus(200)
        ->assertJsonStructure(['id', 'name', 'slug', 'status', 'subscription', 'usage']);
});

test('GET organization detail returns 404 for missing org', function () {
    $admin = ccAdmin();

    $this->withToken(ccToken($admin))
        ->getJson('/api/platform/v1/organizations/999999')
        ->assertStatus(404);
});

// ─── PATCH /organizations/{id}/status ─────────────────────────────────────────

test('PATCH status updates organization status and writes audit log', function () {
    $admin = ccAdmin('super_admin');
    $org = makeOrg(['status' => 'active']);

    $this->withToken(ccToken($admin))
        ->patchJson("/api/platform/v1/organizations/{$org->id}/status", [
            'status' => 'suspended',
            'reason' => 'Billing dispute',
        ])
        ->assertStatus(200)
        ->assertJsonPath('status', 'suspended');

    expect($org->fresh()->status)->toBe('suspended');

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'organization.status_changed',
        'organization_id' => $org->id,
        'admin_user_id' => $admin->id,
    ]);
});

test('PATCH status requires reason field', function () {
    $admin = ccAdmin();
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->patchJson("/api/platform/v1/organizations/{$org->id}/status", [
            'status' => 'suspended',
        ])
        ->assertStatus(422);
});

test('PATCH status rejects invalid status value', function () {
    $admin = ccAdmin();
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->patchJson("/api/platform/v1/organizations/{$org->id}/status", [
            'status' => 'deleted',
            'reason' => 'test',
        ])
        ->assertStatus(422);
});

test('PATCH status is rejected with tenant token', function () {
    $user = User::factory()->create();
    $org = makeOrg();

    $this->withToken($user->createToken('t')->plainTextToken)
        ->patchJson("/api/platform/v1/organizations/{$org->id}/status", [
            'status' => 'suspended',
            'reason' => 'test',
        ])
        ->assertStatus(401);
});

// ─── POST /organizations/{id}/billing/plan ─────────────────────────────────────

test('super_admin can change plan and audit log is written', function () {
    $admin = ccAdmin('super_admin');
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/billing/plan", [
            'plan_code' => 'creator',
            'reason' => 'Manual upgrade for testing',
        ])
        ->assertStatus(200)
        ->assertJsonPath('plan_code', 'creator');

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'organization.plan_changed',
        'organization_id' => $org->id,
    ]);
});

test('billing role can change plan', function () {
    $admin = ccAdmin('billing');
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/billing/plan", [
            'plan_code' => 'studio',
            'reason' => 'Upgrade',
        ])
        ->assertStatus(200);
});

test('admin role cannot change plan', function () {
    $admin = ccAdmin('admin');
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/billing/plan", [
            'plan_code' => 'creator',
            'reason' => 'test',
        ])
        ->assertStatus(403);
});

test('support role cannot change plan', function () {
    $admin = ccAdmin('support');
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/billing/plan", [
            'plan_code' => 'creator',
            'reason' => 'test',
        ])
        ->assertStatus(403);
});

test('changePlan creates subscription row when none exists', function () {
    $admin = ccAdmin('super_admin');
    $org = makeOrg();
    expect($org->subscription)->toBeNull();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/billing/plan", [
            'plan_code' => 'creator',
            'reason' => 'New subscription',
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('subscriptions', [
        'organization_id' => $org->id,
        'plan_code' => 'creator',
    ]);
});

// ─── GET /organizations/{id}/feature-flags ─────────────────────────────────────

test('GET feature-flags returns all catalog flags with plan defaults for org', function () {
    $admin = ccAdmin();
    $org = makeOrg();

    $response = $this->withToken(ccToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/feature-flags")
        ->assertStatus(200);

    $keys = collect($response->json())->pluck('feature_key')->toArray();
    expect($keys)->toContain('analytics', 'api_access', 'leader_messaging');

    $analytics = collect($response->json())->firstWhere('feature_key', 'analytics');
    expect($analytics['source'])->toBe('plan_default');
});

test('GET feature-flags shows manual_override source when override exists', function () {
    $admin = ccAdmin();
    $org = makeOrg();

    DB::table('organization_feature_flags')->insert([
        'organization_id' => $org->id,
        'feature_key'     => 'analytics',
        'is_enabled'      => true,
        'source'          => 'manual_override',
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    $response = $this->withToken(ccToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/feature-flags")
        ->assertStatus(200);

    $analytics = collect($response->json())->firstWhere('feature_key', 'analytics');
    expect($analytics['source'])->toBe('manual_override')
        ->and($analytics['is_enabled'])->toBeTrue();
});

test('GET feature-flags is rejected with tenant token', function () {
    $user = User::factory()->create();
    $org = makeOrg();

    $this->withToken($user->createToken('t')->plainTextToken)
        ->getJson("/api/platform/v1/organizations/{$org->id}/feature-flags")
        ->assertStatus(401);
});

// ─── POST /organizations/{id}/feature-flags ────────────────────────────────────

test('admin can set feature flag override and audit log is written', function () {
    $admin = ccAdmin('admin');
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'analytics',
            'is_enabled'  => true,
        ])
        ->assertStatus(200)
        ->assertJsonPath('source', 'manual_override')
        ->assertJsonPath('is_enabled', true);

    $this->assertDatabaseHas('organization_feature_flags', [
        'organization_id' => $org->id,
        'feature_key'     => 'analytics',
        'is_enabled'      => 1,
        'source'          => 'manual_override',
    ]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'feature_flag_override',
        'organization_id' => $org->id,
    ]);
});

test('support role cannot set feature flag override', function () {
    $admin = ccAdmin('support');
    $org = makeOrg();

    $this->withToken(ccToken($admin))
        ->postJson("/api/platform/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'analytics',
            'is_enabled'  => true,
        ])
        ->assertStatus(403);
});

test('POST feature-flags is rejected with tenant token', function () {
    $user = User::factory()->create();
    $org = makeOrg();

    $this->withToken($user->createToken('t')->plainTextToken)
        ->postJson("/api/platform/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'analytics',
            'is_enabled'  => true,
        ])
        ->assertStatus(401);
});
