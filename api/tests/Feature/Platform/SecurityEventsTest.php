<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\SecurityEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Sec',
        'last_name'     => "Admin{$seq}",
        'email'         => "sec{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function secToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function makeSecurityEvent(array $overrides = []): SecurityEvent
{
    return SecurityEvent::create(array_merge([
        'event_type'  => 'suspicious_login',
        'severity'    => 'medium',
        'description' => 'Multiple failed login attempts',
    ], $overrides));
}

// ─── GET /security/events ─────────────────────────────────────────────────────

test('GET /security/events returns paginated list with required shape', function () {
    $admin = secAdmin();
    makeSecurityEvent();
    makeSecurityEvent(['event_type' => 'account_locked', 'severity' => 'high']);

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [['id', 'event_type', 'severity', 'description',
                        'organization_id', 'organization_name',
                        'user_id', 'user_email', 'metadata_json', 'created_at']],
            'total', 'per_page',
        ])
        ->assertJsonPath('total', 2);
});

test('GET /security/events filters by severity', function () {
    $admin = secAdmin();
    makeSecurityEvent(['severity' => 'low']);
    makeSecurityEvent(['severity' => 'critical']);
    makeSecurityEvent(['severity' => 'critical']);

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events?severity=critical')
        ->assertStatus(200)
        ->assertJsonPath('total', 2);
});

test('GET /security/events filters by event_type', function () {
    $admin = secAdmin();
    makeSecurityEvent(['event_type' => 'suspicious_login']);
    makeSecurityEvent(['event_type' => 'brute_force_detected']);

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events?event_type=brute_force_detected')
        ->assertStatus(200)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.event_type', 'brute_force_detected');
});

test('GET /security/events filters by organization_id', function () {
    $admin = secAdmin();
    $org   = Organization::factory()->create();
    makeSecurityEvent(['organization_id' => $org->id]);
    makeSecurityEvent();

    $this->withToken(secToken($admin))
        ->getJson("/api/platform/v1/security/events?organization_id={$org->id}")
        ->assertStatus(200)
        ->assertJsonPath('total', 1);
});

test('GET /security/events includes organization_name when org is set', function () {
    $admin = secAdmin();
    $org   = Organization::factory()->create(['name' => 'Test Corp']);
    makeSecurityEvent(['organization_id' => $org->id]);

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events')
        ->assertStatus(200)
        ->assertJsonPath('data.0.organization_name', 'Test Corp');
});

test('GET /security/events is accessible by admin role', function () {
    $admin = secAdmin('admin');

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events')
        ->assertStatus(200);
});

test('GET /security/events is 403 for support role', function () {
    $admin = secAdmin('support');

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events')
        ->assertStatus(403);
});

test('GET /security/events is 403 for billing role', function () {
    $admin = secAdmin('billing');

    $this->withToken(secToken($admin))
        ->getJson('/api/platform/v1/security/events')
        ->assertStatus(403);
});

// ─── Auth isolation ────────────────────────────────────────────────────────────

test('GET /security/events is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/security/events')
        ->assertStatus(401);
});

test('GET /security/events requires authentication', function () {
    $this->getJson('/api/platform/v1/security/events')->assertStatus(401);
});
