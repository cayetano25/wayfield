<?php

use App\Models\Organization;
use App\Models\PlatformAdmin;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlatformAdmin(string $role = 'super_admin'): array
{
    $user  = User::factory()->create();
    $admin = PlatformAdmin::create([
        'user_id'   => $user->id,
        'role'      => $role,
        'is_active' => true,
    ]);

    return compact('user', 'admin');
}

// ─── Middleware gate ──────────────────────────────────────────────────────────

test('unauthenticated request to platform endpoint returns 401', function () {
    $this->getJson('/api/v1/platform/organizations')
        ->assertStatus(401);
});

test('regular user (no platform admin record) is denied with 403', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/platform/organizations')
        ->assertStatus(403);
});

test('inactive platform admin is denied with 403', function () {
    $user = User::factory()->create();
    PlatformAdmin::create([
        'user_id'   => $user->id,
        'role'      => 'super_admin',
        'is_active' => false,
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/platform/organizations')
        ->assertStatus(403);
});

test('active platform admin can access organization list', function () {
    ['user' => $user] = makePlatformAdmin('super_admin');
    Organization::factory()->count(3)->create();

    $this->actingAs($user)
        ->getJson('/api/v1/platform/organizations')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'current_page']);
});

// ─── Role-based restrictions ──────────────────────────────────────────────────

test('support role platform admin can access organizations', function () {
    ['user' => $user] = makePlatformAdmin('support');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/organizations')
        ->assertStatus(200);
});

test('finance role cannot access audit-logs (restricted to super_admin and ops)', function () {
    ['user' => $user] = makePlatformAdmin('finance');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/audit-logs')
        ->assertStatus(403);
});

test('ops role can access audit-logs', function () {
    ['user' => $user] = makePlatformAdmin('ops');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/audit-logs')
        ->assertStatus(200);
});

test('super_admin can access audit-logs', function () {
    ['user' => $user] = makePlatformAdmin('super_admin');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/audit-logs')
        ->assertStatus(200);
});

test('support role cannot access financial invoices', function () {
    ['user' => $user] = makePlatformAdmin('support');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/financials/invoices')
        ->assertStatus(403);
});

test('finance role can access financial invoices', function () {
    ['user' => $user] = makePlatformAdmin('finance');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/financials/invoices')
        ->assertStatus(200);
});

test('super_admin can access system health endpoint', function () {
    ['user' => $user] = makePlatformAdmin('super_admin');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/health')
        ->assertStatus(200);
});

test('support role cannot access system health endpoint', function () {
    ['user' => $user] = makePlatformAdmin('support');

    $this->actingAs($user)
        ->getJson('/api/v1/platform/health')
        ->assertStatus(403);
});

// ─── Organization detail ──────────────────────────────────────────────────────

test('platform admin can view a specific organization', function () {
    ['user' => $user] = makePlatformAdmin('super_admin');
    $org = Organization::factory()->create();

    $this->actingAs($user)
        ->getJson("/api/v1/platform/organizations/{$org->id}")
        ->assertStatus(200)
        ->assertJsonFragment(['id' => $org->id]);
});

// ─── User list ────────────────────────────────────────────────────────────────

test('platform admin can list all users', function () {
    ['user' => $user] = makePlatformAdmin('super_admin');
    User::factory()->count(5)->create();

    $this->actingAs($user)
        ->getJson('/api/v1/platform/users')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'current_page']);
});

test('platform admin user detail never exposes password_hash', function () {
    ['user' => $adminUser] = makePlatformAdmin('super_admin');
    $targetUser = User::factory()->create();

    $response = $this->actingAs($adminUser)
        ->getJson("/api/v1/platform/users/{$targetUser->id}")
        ->assertStatus(200);

    $this->assertArrayNotHasKey('password_hash', $response->json());
});
