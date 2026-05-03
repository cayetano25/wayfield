<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helper ───────────────────────────────────────────────────────────────────

function makePlatformAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'CC',
        'last_name'     => "Admin{$seq}",
        'email'         => "cc{$seq}@wayfield.internal",
        'password_hash' => Hash::make('secure-password'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function platformToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

// ─── Access control ───────────────────────────────────────────────────────────

test('overview requires authentication', function () {
    $this->getJson('/api/platform/v1/overview')
        ->assertStatus(401);
});

test('tenant sanctum token is rejected on overview endpoint', function () {
    $tenantUser = User::factory()->create();
    $token      = $tenantUser->createToken('tenant_token', ['*'])->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(401);
});

test('inactive platform admin is rejected on overview endpoint', function () {
    $admin = makePlatformAdmin();
    $token = platformToken($admin);
    $admin->update(['is_active' => false]);

    $this->withToken($token)
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(403);
});

// ─── Response shape ───────────────────────────────────────────────────────────

test('overview returns 200 with correct top-level shape', function () {
    $admin = makePlatformAdmin();

    $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200)
        ->assertJsonStructure([
            'organizations' => ['total', 'by_status', 'by_plan'],
            'users'         => ['total', 'active_30_days', 'new_7_days'],
            'workshops'     => ['total', 'by_status'],
            'generated_at',
            'recent_audit_events',
        ]);
});

test('overview by_plan contains all four plan keys', function () {
    $admin = makePlatformAdmin();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200);

    $byPlan = $response->json('organizations.by_plan');

    expect($byPlan)->toHaveKeys(['foundation', 'creator', 'studio', 'enterprise']);
});

// ─── Counts reflect database state ───────────────────────────────────────────

test('overview organization total reflects seeded data', function () {
    $admin = makePlatformAdmin();
    Organization::factory()->count(3)->create();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200);

    expect($response->json('organizations.total'))->toBe(3);
});

test('overview user total reflects seeded data', function () {
    $admin = makePlatformAdmin();
    User::factory()->count(5)->create();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200);

    // total should include the 5 factory users (admin is AdminUser, not User)
    expect($response->json('users.total'))->toBe(5);
});

test('overview workshop total reflects seeded data', function () {
    $admin = makePlatformAdmin();
    Organization::factory()->has(Workshop::factory()->count(4))->create();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200);

    expect($response->json('workshops.total'))->toBe(4);
});

test('overview generated_at is a valid ISO 8601 timestamp', function () {
    $admin = makePlatformAdmin();

    $response = $this->withToken(platformToken($admin))
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200);

    $generatedAt = $response->json('generated_at');
    expect(\Carbon\Carbon::parse($generatedAt))->toBeInstanceOf(\Carbon\Carbon::class);
});

// ─── All platform admin roles can read overview ───────────────────────────────

test('admin role can access overview', function () {
    $admin = makePlatformAdmin('admin');
    $this->withToken(platformToken($admin))->getJson('/api/platform/v1/overview')->assertStatus(200);
});

test('support role can access overview', function () {
    $admin = makePlatformAdmin('support');
    $this->withToken(platformToken($admin))->getJson('/api/platform/v1/overview')->assertStatus(200);
});

test('billing role can access overview', function () {
    $admin = makePlatformAdmin('billing');
    $this->withToken(platformToken($admin))->getJson('/api/platform/v1/overview')->assertStatus(200);
});

test('readonly role can access overview', function () {
    $admin = makePlatformAdmin('readonly');
    $this->withToken(platformToken($admin))->getJson('/api/platform/v1/overview')->assertStatus(200);
});
