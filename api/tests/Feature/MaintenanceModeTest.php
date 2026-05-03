<?php

use App\Models\AdminUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedMaintenanceConfig(bool $active = false): void
{
    DB::table('platform_config')->insert([
        ['config_key' => 'maintenance_mode', 'config_value' => $active ? 'true' : 'false', 'value_type' => 'boolean', 'description' => 'Maintenance mode', 'updated_at' => now(), 'created_at' => now()],
        ['config_key' => 'maintenance_message', 'config_value' => 'Down for maintenance.', 'value_type' => 'string', 'description' => 'Message', 'updated_at' => now(), 'created_at' => now()],
        ['config_key' => 'maintenance_ends_at', 'config_value' => '', 'value_type' => 'string', 'description' => 'End time', 'updated_at' => now(), 'created_at' => now()],
    ]);
}

function makeSuperAdmin(): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Super',
        'last_name'     => "Admin{$seq}",
        'email'         => "super{$seq}@wayfield.internal",
        'password_hash' => Hash::make('password'),
        'role'          => 'super_admin',
        'is_active'     => true,
    ]);
}

beforeEach(function () {
    Cache::flush();
});

// ─── Disabled maintenance mode ────────────────────────────────────────────────

test('tenant routes return normally when maintenance mode is disabled', function () {
    seedMaintenanceConfig(false);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson('/api/v1/me')
        ->assertStatus(200);
});

// ─── Enabled maintenance mode ─────────────────────────────────────────────────

test('tenant route returns 503 with correct shape when maintenance is enabled', function () {
    seedMaintenanceConfig(true);

    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/me')
        ->assertStatus(503);

    expect($response->json('error'))->toBe('maintenance_mode');
    expect($response->json('message'))->toBeString();
    expect($response->json('retry_after'))->toBe(300);
});

test('503 response includes Retry-After and X-Maintenance-Mode headers', function () {
    seedMaintenanceConfig(true);

    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->getJson('/api/v1/me')
        ->assertStatus(503);

    expect($response->headers->get('Retry-After'))->toBe('300');
    expect($response->headers->get('X-Maintenance-Mode'))->toBe('true');
});

test('system announcements endpoint always returns 200 during maintenance', function () {
    seedMaintenanceConfig(true);

    $this->getJson('/api/v1/system/announcements')
        ->assertStatus(200);
});

test('platform overview returns 200 during tenant maintenance', function () {
    seedMaintenanceConfig(true);
    $admin = makeSuperAdmin();

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/overview')
        ->assertStatus(200);
});

test('login endpoint not blocked by maintenance mode', function () {
    seedMaintenanceConfig(true);

    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => 'notreal@example.com',
        'password' => 'wrong',
    ]);

    // Auth logic runs (4xx) — maintenance mode does NOT block login (503).
    expect($response->status())->not->toBe(503);
});

test('stripe webhook endpoint not blocked by maintenance mode', function () {
    seedMaintenanceConfig(true);

    // Webhooks bypass maintenance — will fail signature check (400), not maintenance (503)
    $response = $this->postJson('/api/webhooks/stripe', []);
    expect($response->status())->not->toBe(503);
});

// ─── Platform API — maintenance management ────────────────────────────────────

test('super_admin can enable maintenance mode', function () {
    seedMaintenanceConfig(false);
    $admin = makeSuperAdmin();

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/maintenance/enable', [
            'message' => 'We are down for upgrades.',
            'ends_at' => null,
        ])
        ->assertStatus(200)
        ->assertJsonPath('maintenance_mode', true);

    expect(DB::table('platform_config')->where('config_key', 'maintenance_mode')->value('config_value'))
        ->toBe('true');

    $this->assertDatabaseHas('platform_audit_logs', [
        'action'        => 'maintenance_mode.enabled',
        'admin_user_id' => $admin->id,
    ]);
});

test('super_admin can disable maintenance mode', function () {
    seedMaintenanceConfig(true);
    $admin = makeSuperAdmin();

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/maintenance/disable')
        ->assertStatus(200)
        ->assertJsonPath('maintenance_mode', false);

    expect(DB::table('platform_config')->where('config_key', 'maintenance_mode')->value('config_value'))
        ->toBe('false');

    $this->assertDatabaseHas('platform_audit_logs', [
        'action'        => 'maintenance_mode.disabled',
        'admin_user_id' => $admin->id,
    ]);
});

test('non_super_admin cannot enable maintenance mode', function () {
    seedMaintenanceConfig(false);

    $admin = AdminUser::create([
        'first_name'    => 'Regular',
        'last_name'     => 'Admin',
        'email'         => 'regular@wayfield.internal',
        'password_hash' => Hash::make('password'),
        'role'          => 'admin',
        'is_active'     => true,
    ]);

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/maintenance/enable', ['message' => 'Down.'])
        ->assertStatus(403);
});

test('maintenance status endpoint returns current state', function () {
    seedMaintenanceConfig(false);
    $admin = makeSuperAdmin();

    $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/maintenance')
        ->assertStatus(200)
        ->assertJsonStructure(['maintenance_mode', 'maintenance_message', 'maintenance_ends_at']);
});
