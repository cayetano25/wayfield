<?php

use App\Models\AdminUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeAdminUser(array $overrides = []): AdminUser
{
    return AdminUser::create(array_merge([
        'first_name' => 'Platform',
        'last_name' => 'Admin',
        'email' => 'admin@wayfield.internal',
        'password_hash' => Hash::make('secure-password'),
        'role' => 'admin',
        'is_active' => true,
    ], $overrides));
}

// ─── Login ────────────────────────────────────────────────────────────────────

test('platform admin can log in with valid credentials', function () {
    makeAdminUser();

    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email' => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure([
            'token',
            'admin_user' => ['id', 'first_name', 'last_name', 'email', 'role'],
        ])
        ->assertJsonPath('admin_user.email', 'admin@wayfield.internal');
});

test('platform admin login creates admin_login_events record on success', function () {
    makeAdminUser();

    $this->postJson('/api/platform/v1/auth/login', [
        'email' => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);

    $this->assertDatabaseHas('admin_login_events', [
        'email_attempted' => 'admin@wayfield.internal',
        'outcome' => 'success',
    ]);
});

test('invalid credentials create failed admin_login_events record', function () {
    makeAdminUser();

    $this->postJson('/api/platform/v1/auth/login', [
        'email' => 'admin@wayfield.internal',
        'password' => 'wrong-password',
    ]);

    $this->assertDatabaseHas('admin_login_events', [
        'email_attempted' => 'admin@wayfield.internal',
        'outcome' => 'failed',
    ]);
});

test('login fails with wrong password and returns 401', function () {
    makeAdminUser();

    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email' => 'admin@wayfield.internal',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(401);
});

test('login fails for unknown email and returns 401', function () {
    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email' => 'nobody@wayfield.internal',
        'password' => 'any-password',
    ]);

    $response->assertStatus(401);
});

// ─── Token isolation ──────────────────────────────────────────────────────────

test('platform token cannot access tenant API routes', function () {
    $adminUser = makeAdminUser();
    $token = $adminUser->createToken('platform_token', ['platform:*'])->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/me');

    // 403 (not 401): the token IS authenticated but forbidden on tenant routes.
    // EnsureTenantToken rejects non-User tokens with tenant_auth_required.
    $response->assertStatus(403);
});

test('tenant token cannot access platform API routes', function () {
    $user = User::factory()->create();
    $token = $user->createToken('tenant_token', ['*'])->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/platform/v1/auth/me');

    $response->assertStatus(401);
});

// ─── Me endpoint ──────────────────────────────────────────────────────────────

test('authenticated platform admin can retrieve own profile', function () {
    $adminUser = makeAdminUser();
    $token = $adminUser->createToken('platform_token', ['platform:*'])->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/platform/v1/auth/me');

    $response->assertStatus(200)
        ->assertJsonPath('email', 'admin@wayfield.internal')
        ->assertJsonPath('role', 'admin');
});

// ─── Logout ───────────────────────────────────────────────────────────────────

test('logout revokes platform token', function () {
    $adminUser = makeAdminUser();
    $tokenResult = $adminUser->createToken('platform_token', ['platform:*']);
    $plainToken = $tokenResult->plainTextToken;

    $this->withToken($plainToken)
        ->postJson('/api/platform/v1/auth/logout')
        ->assertStatus(200);

    // Verify the token row was deleted from personal_access_tokens
    $this->assertDatabaseMissing('personal_access_tokens', [
        'id' => $tokenResult->accessToken->id,
    ]);
});

// ─── Inactive account ─────────────────────────────────────────────────────────

test('inactive platform admin cannot log in', function () {
    makeAdminUser(['is_active' => false]);

    $response = $this->postJson('/api/platform/v1/auth/login', [
        'email' => 'admin@wayfield.internal',
        'password' => 'secure-password',
    ]);

    $response->assertStatus(403);

    $this->assertDatabaseHas('admin_login_events', [
        'email_attempted' => 'admin@wayfield.internal',
        'outcome' => 'locked',
    ]);
});
