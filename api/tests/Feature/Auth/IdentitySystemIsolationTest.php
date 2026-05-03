<?php

declare(strict_types=1);

use App\Models\AdminUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Tenant token is rejected on platform routes ──────────

test('tenant user token is rejected on platform routes', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $token = $user->createToken('web')->plainTextToken;

    // auth:platform_admin cannot authenticate a tenant token — returns 401
    $this->withToken($token)
        ->getJson('/api/platform/v1/health')
        ->assertStatus(401);
});

// ─── Platform token is rejected on tenant routes ─────────

test('platform admin token is rejected on tenant routes', function () {
    $admin = AdminUser::factory()->create([
        'role' => 'admin',
        'is_active' => true,
    ]);
    $token = $admin->createToken('platform')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(403)
        ->assertJson(['error' => 'tenant_auth_required']);
});

// ─── Correct token on correct route ──────────────────────

test('valid tenant token authenticates on tenant routes', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200);
});

test('valid platform token authenticates on platform routes', function () {
    $admin = AdminUser::factory()->create([
        'role' => 'admin',
        'is_active' => true,
    ]);
    $token = $admin->createToken('platform')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/health')
        ->assertStatus(200)
        ->assertJsonStructure(['date', 'last_hour_failed_logins', 'security_events_24h']);
});

// ─── Inactive platform admin is rejected ─────────────────

test('inactive platform admin token is rejected on platform routes', function () {
    $admin = AdminUser::factory()->create([
        'role' => 'support',
        'is_active' => false,
    ]);
    $token = $admin->createToken('platform')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/health')
        ->assertStatus(403)
        ->assertJson(['error' => 'account_inactive']);
});

// ─── Unauthenticated request on tenant route ─────────────

test('unauthenticated request on tenant protected route returns 401', function () {
    $this->getJson('/api/v1/me')
        ->assertStatus(401);
});
