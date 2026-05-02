<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAdmin(string $role = 'super_admin', bool $active = true): AdminUser
{
    static $counter = 0;
    $counter++;

    return AdminUser::create([
        'first_name' => 'Admin',
        'last_name' => "User{$counter}",
        'email' => "admin{$counter}@wayfield.internal",
        'password_hash' => Hash::make('password'),
        'role' => $role,
        'is_active' => $active,
    ]);
}

// ─── Unauthenticated / non-admin ──────────────────────────────────────────────

test('unauthenticated request to platform endpoint returns 401', function () {
    $this->getJson('/api/platform/v1/organizations')
        ->assertStatus(401);
});

test('regular user (no AdminUser record) is denied with 401', function () {
    $user = User::factory()->create();
    // Use a real tenant Sanctum token — platform routes must reject it
    $token = $user->createToken('tenant_token', ['*'])->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/organizations')
        ->assertStatus(401);
});

test('inactive platform admin is denied with 403', function () {
    $admin = makeAdmin('super_admin', false);

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/organizations')
        ->assertStatus(403);
});

// ─── Active admin access ──────────────────────────────────────────────────────

test('active super_admin can access organization list', function () {
    $admin = makeAdmin('super_admin');
    Organization::factory()->count(3)->create();

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/organizations')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'current_page']);
});

test('support role platform admin can access organizations', function () {
    $admin = makeAdmin('support');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/organizations')
        ->assertStatus(200);
});

// ─── Role-based restrictions ──────────────────────────────────────────────────

test('billing role cannot access audit-logs (restricted to super_admin and admin)', function () {
    $admin = makeAdmin('billing');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(403);
});

test('ops role can access audit-logs', function () {
    $admin = makeAdmin('admin');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(200);
});

test('super_admin can access audit-logs', function () {
    $admin = makeAdmin('super_admin');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(200);
});

test('support role cannot access financial invoices', function () {
    $admin = makeAdmin('support');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/financials/invoices')
        ->assertStatus(403);
});

test('finance role can access financial invoices', function () {
    $admin = makeAdmin('billing');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/financials/invoices')
        ->assertStatus(200);
});

test('super_admin can access system health endpoint', function () {
    $admin = makeAdmin('super_admin');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/health')
        ->assertStatus(200);
});

test('support role cannot access system health endpoint', function () {
    $admin = makeAdmin('support');

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/health')
        ->assertStatus(403);
});

// ─── Organization detail ──────────────────────────────────────────────────────

test('platform admin can view a specific organization', function () {
    $admin = makeAdmin('super_admin');
    $org = Organization::factory()->create();

    $this->actingAs($admin, 'platform_admin')
        ->getJson("/api/platform/v1/organizations/{$org->id}")
        ->assertStatus(200)
        ->assertJsonFragment(['id' => $org->id]);
});

// ─── User list ────────────────────────────────────────────────────────────────

test('platform admin can list all users', function () {
    $admin = makeAdmin('super_admin');
    User::factory()->count(5)->create();

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/users')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'current_page']);
});

test('platform admin user detail never exposes password_hash', function () {
    $admin = makeAdmin('super_admin');
    $targetUser = User::factory()->create();

    $response = $this->actingAs($admin, 'platform_admin')
        ->getJson("/api/platform/v1/users/{$targetUser->id}")
        ->assertStatus(200);

    $this->assertArrayNotHasKey('password_hash', $response->json());
});
