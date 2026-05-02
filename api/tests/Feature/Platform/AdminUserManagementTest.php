<?php

use App\Models\AdminUser;
use App\Models\PlatformAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function aumAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'AUM',
        'last_name'     => "Admin{$seq}",
        'email'         => "aum{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function aumToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

// ─── GET /admins ───────────────────────────────────────────────────────────────

test('GET /admins returns list for super_admin', function () {
    $admin = aumAdmin();
    aumAdmin('admin');

    $this->withToken(aumToken($admin))
        ->getJson('/api/platform/v1/admins')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [['id', 'first_name', 'last_name', 'email', 'role', 'is_active', 'last_login_at', 'created_at']],
        ]);
});

test('GET /admins is 403 for admin role', function () {
    $admin = aumAdmin('admin');

    $this->withToken(aumToken($admin))
        ->getJson('/api/platform/v1/admins')
        ->assertStatus(403);
});

test('GET /admins is 403 for support role', function () {
    $admin = aumAdmin('support');

    $this->withToken(aumToken($admin))
        ->getJson('/api/platform/v1/admins')
        ->assertStatus(403);
});

// ─── POST /admins ──────────────────────────────────────────────────────────────

test('POST /admins creates admin and logs audit', function () {
    $actor = aumAdmin();

    $this->withToken(aumToken($actor))
        ->postJson('/api/platform/v1/admins', [
            'first_name'            => 'New',
            'last_name'             => 'Member',
            'email'                 => 'new@wayfield.internal',
            'password'              => 'securepassword1',
            'password_confirmation' => 'securepassword1',
            'role'                  => 'support',
        ])
        ->assertStatus(201)
        ->assertJsonPath('email', 'new@wayfield.internal')
        ->assertJsonPath('role', 'support');

    expect(PlatformAuditLog::where('action', 'admin_user.created')->exists())->toBeTrue();
});

test('POST /admins cannot create with super_admin role', function () {
    $actor = aumAdmin();

    $this->withToken(aumToken($actor))
        ->postJson('/api/platform/v1/admins', [
            'first_name'            => 'Bad',
            'last_name'             => 'Actor',
            'email'                 => 'bad@wayfield.internal',
            'password'              => 'securepassword1',
            'password_confirmation' => 'securepassword1',
            'role'                  => 'super_admin',
        ])
        ->assertStatus(422);
});

test('POST /admins rejects password shorter than 12 chars', function () {
    $actor = aumAdmin();

    $this->withToken(aumToken($actor))
        ->postJson('/api/platform/v1/admins', [
            'first_name'            => 'Short',
            'last_name'             => 'Pass',
            'email'                 => 'short@wayfield.internal',
            'password'              => 'tooshort',
            'password_confirmation' => 'tooshort',
            'role'                  => 'admin',
        ])
        ->assertStatus(422);
});

test('POST /admins is 403 for non-super_admin', function () {
    $actor = aumAdmin('admin');

    $this->withToken(aumToken($actor))
        ->postJson('/api/platform/v1/admins', [
            'first_name'            => 'X',
            'last_name'             => 'Y',
            'email'                 => 'xy@wayfield.internal',
            'password'              => 'securepassword1',
            'password_confirmation' => 'securepassword1',
            'role'                  => 'support',
        ])
        ->assertStatus(403);
});

// ─── PATCH /admins/{id}/role ───────────────────────────────────────────────────

test('PATCH /admins/{id}/role updates role and logs audit', function () {
    $actor  = aumAdmin();
    $target = aumAdmin('admin');

    $this->withToken(aumToken($actor))
        ->patchJson("/api/platform/v1/admins/{$target->id}/role", ['role' => 'support'])
        ->assertStatus(200)
        ->assertJsonPath('role', 'support');

    expect(PlatformAuditLog::where('action', 'admin_user.role_changed')->exists())->toBeTrue();
});

test('PATCH /admins/{id}/role cannot update own role', function () {
    $actor = aumAdmin();

    $this->withToken(aumToken($actor))
        ->patchJson("/api/platform/v1/admins/{$actor->id}/role", ['role' => 'admin'])
        ->assertStatus(403);
});

test('PATCH /admins/{id}/role is 403 for non-super_admin', function () {
    $actor  = aumAdmin('admin');
    $target = aumAdmin('support');

    $this->withToken(aumToken($actor))
        ->patchJson("/api/platform/v1/admins/{$target->id}/role", ['role' => 'readonly'])
        ->assertStatus(403);
});

// ─── PATCH /admins/{id}/status ─────────────────────────────────────────────────

test('PATCH /admins/{id}/status deactivates admin and logs audit', function () {
    $actor  = aumAdmin();
    $target = aumAdmin('admin');

    $this->withToken(aumToken($actor))
        ->patchJson("/api/platform/v1/admins/{$target->id}/status", ['is_active' => false])
        ->assertStatus(200)
        ->assertJsonPath('is_active', false);

    expect(PlatformAuditLog::where('action', 'admin_user.status_changed')->exists())->toBeTrue();
});

test('PATCH /admins/{id}/status cannot deactivate own account', function () {
    $actor = aumAdmin();

    $this->withToken(aumToken($actor))
        ->patchJson("/api/platform/v1/admins/{$actor->id}/status", ['is_active' => false])
        ->assertStatus(403);
});

test('PATCH /admins/{id}/status is 403 for non-super_admin', function () {
    $actor  = aumAdmin('admin');
    $target = aumAdmin('support');

    $this->withToken(aumToken($actor))
        ->patchJson("/api/platform/v1/admins/{$target->id}/status", ['is_active' => false])
        ->assertStatus(403);
});

// ─── Auth isolation ────────────────────────────────────────────────────────────

test('GET /admins is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/admins')
        ->assertStatus(401);
});

test('POST /admins is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/platform/v1/admins', [])
        ->assertStatus(401);
});

test('GET /admins requires authentication', function () {
    $this->getJson('/api/platform/v1/admins')->assertStatus(401);
});
