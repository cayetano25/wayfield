<?php

use App\Models\AdminUser;
use App\Models\PlatformAuditLog;
use App\Models\PlatformConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cfgAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Cfg',
        'last_name'     => "Admin{$seq}",
        'email'         => "cfg{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function cfgToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function seedConfigKey(string $key, string $value = ''): PlatformConfig
{
    return PlatformConfig::firstOrCreate(
        ['config_key' => $key],
        ['config_value' => $value, 'description' => "Test config: {$key}"]
    );
}

// ─── GET /config ───────────────────────────────────────────────────────────────

test('GET /config returns all config rows', function () {
    $admin = cfgAdmin();
    seedConfigKey('test_key_a', 'hello');
    seedConfigKey('test_key_b', '');

    $response = $this->withToken(cfgToken($admin))
        ->getJson('/api/platform/v1/config')
        ->assertStatus(200);

    $data = $response->json();
    expect($data)->toBeArray();

    $keys = array_column($data, 'config_key');
    expect(in_array('test_key_a', $keys))->toBeTrue();
    expect(in_array('test_key_b', $keys))->toBeTrue();
});

test('GET /config is accessible by admin role', function () {
    $admin = cfgAdmin('admin');

    $this->withToken(cfgToken($admin))
        ->getJson('/api/platform/v1/config')
        ->assertStatus(200);
});

test('GET /config is accessible by support role', function () {
    $admin = cfgAdmin('support');

    $this->withToken(cfgToken($admin))
        ->getJson('/api/platform/v1/config')
        ->assertStatus(200);
});

// ─── PUT /config/{key} ────────────────────────────────────────────────────────

test('PUT /config/{key} by super_admin updates value and logs audit', function () {
    $admin = cfgAdmin();
    seedConfigKey('support_tool_url', '');

    $this->withToken(cfgToken($admin))
        ->putJson('/api/platform/v1/config/support_tool_url', ['value' => 'https://help.example.com'])
        ->assertStatus(200)
        ->assertJsonPath('config_key', 'support_tool_url')
        ->assertJsonPath('config_value', 'https://help.example.com');

    expect(PlatformConfig::where('config_key', 'support_tool_url')->value('config_value'))
        ->toBe('https://help.example.com');

    expect(PlatformAuditLog::where('action', 'platform_config.updated')->exists())->toBeTrue();
});

test('PUT /config/{key} accepts empty value clearing the config', function () {
    $admin = cfgAdmin();
    seedConfigKey('maintenance_mode', 'true');

    $this->withToken(cfgToken($admin))
        ->putJson('/api/platform/v1/config/maintenance_mode', ['value' => ''])
        ->assertStatus(200)
        ->assertJsonPath('config_value', '');
});

test('PUT /config/{key} returns 404 for unknown key', function () {
    $admin = cfgAdmin();

    $this->withToken(cfgToken($admin))
        ->putJson('/api/platform/v1/config/nonexistent_key', ['value' => 'x'])
        ->assertStatus(404);
});

test('PUT /config/{key} is 403 for admin role', function () {
    $admin = cfgAdmin('admin');
    seedConfigKey('test_key', 'old');

    $this->withToken(cfgToken($admin))
        ->putJson('/api/platform/v1/config/test_key', ['value' => 'new'])
        ->assertStatus(403);
});

test('PUT /config/{key} is 403 for support role', function () {
    $admin = cfgAdmin('support');
    seedConfigKey('test_key', 'old');

    $this->withToken(cfgToken($admin))
        ->putJson('/api/platform/v1/config/test_key', ['value' => 'new'])
        ->assertStatus(403);
});

// ─── Auth isolation ────────────────────────────────────────────────────────────

test('GET /config is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/config')
        ->assertStatus(401);
});

test('PUT /config/{key} is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;
    seedConfigKey('test_key', 'old');

    $this->withToken($token)
        ->putJson('/api/platform/v1/config/test_key', ['value' => 'new'])
        ->assertStatus(401);
});
