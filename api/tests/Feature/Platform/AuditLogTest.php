<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function auditAdmin(string $role = 'admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Audit',
        'last_name'     => "Admin{$seq}",
        'email'         => "audit{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function auditToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function seedAuditLog(AdminUser $admin, ?Organization $org = null, string $action = 'test.action'): void
{
    DB::table('platform_audit_logs')->insert([
        'admin_user_id'   => $admin->id,
        'action'          => $action,
        'organization_id' => $org?->id,
        'metadata_json'   => null,
        'ip_address'      => '127.0.0.1',
        'created_at'      => now(),
    ]);
}

// ─── Access ───────────────────────────────────────────────────────────────────

test('GET audit-logs requires authentication', function () {
    $this->getJson('/api/platform/v1/audit-logs')->assertStatus(401);
});

test('tenant token is rejected on audit-logs', function () {
    $user = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(401);
});

test('support role cannot access audit-logs', function () {
    $admin = auditAdmin('support');

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(403);
});

test('readonly role cannot access audit-logs', function () {
    $admin = auditAdmin('readonly');

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(403);
});

// ─── Response shape ───────────────────────────────────────────────────────────

test('GET audit-logs returns paginated platform audit entries', function () {
    $admin = auditAdmin('admin');
    seedAuditLog($admin);
    seedAuditLog($admin);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total', 'per_page']);

    expect($response->json('data'))->toHaveCount(2);
    expect($response->json('data.0'))->toHaveKeys([
        'id', 'action', 'admin_user_id', 'admin_name', 'organization_id',
        'organization_name', 'metadata_json', 'created_at',
    ]);
});

// ─── Filters ──────────────────────────────────────────────────────────────────

test('audit-logs filters by organization_id', function () {
    $admin = auditAdmin();
    $org = Organization::factory()->create();
    seedAuditLog($admin, $org, 'org.action');
    seedAuditLog($admin, null, 'other.action');

    $response = $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/audit-logs?organization_id={$org->id}")
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.action'))->toBe('org.action');
});

test('audit-logs filters by admin_user_id', function () {
    $admin1 = auditAdmin();
    $admin2 = auditAdmin();
    seedAuditLog($admin1, null, 'action.one');
    seedAuditLog($admin2, null, 'action.two');

    $response = $this->withToken(auditToken($admin1))
        ->getJson("/api/platform/v1/audit-logs?admin_user_id={$admin1->id}")
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.action'))->toBe('action.one');
});

test('audit-logs filters action with partial match', function () {
    $admin = auditAdmin();
    seedAuditLog($admin, null, 'organization.plan_changed');
    seedAuditLog($admin, null, 'organization.status_changed');
    seedAuditLog($admin, null, 'feature_flag_override');

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/audit-logs?action=plan_changed')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.action'))->toBe('organization.plan_changed');
});

test('audit-logs filters by date_from and date_to', function () {
    $admin = auditAdmin();

    DB::table('platform_audit_logs')->insert([
        'admin_user_id' => $admin->id,
        'action'        => 'old.action',
        'created_at'    => now()->subDays(10),
    ]);
    seedAuditLog($admin, null, 'recent.action');

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/audit-logs?date_from='.now()->subDay()->toDateString())
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.action'))->toBe('recent.action');
});

test('super_admin can access audit-logs', function () {
    $admin = auditAdmin('super_admin');
    seedAuditLog($admin);

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/audit-logs')
        ->assertStatus(200);
});
