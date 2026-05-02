<?php

use App\Models\AdminUser;
use App\Models\AutomationRule;
use App\Models\Organization;
use App\Models\PlatformAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function autoAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Auto',
        'last_name'     => "Admin{$seq}",
        'email'         => "auto{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function autoToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function makeRule(Organization $org, array $overrides = []): AutomationRule
{
    return AutomationRule::create(array_merge([
        'organization_id' => $org->id,
        'name'            => 'Test Rule',
        'trigger_type'    => 'plan_downgrade',
        'action_type'     => 'send_email',
        'is_active'       => true,
    ], $overrides));
}

// ─── GET /automations — list ──────────────────────────────────────────────────��

test('GET /automations returns paginated list', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();
    makeRule($org);
    makeRule($org);

    $this->withToken(autoToken($admin))
        ->getJson('/api/platform/v1/automations')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [['id', 'organization_id', 'organization_name', 'name',
                        'trigger_type', 'action_type', 'is_active', 'last_run_at', 'created_at']],
            'total', 'per_page',
        ])
        ->assertJsonPath('total', 2);
});

test('GET /automations filters by organization_id', function () {
    $admin = autoAdmin();
    $org1  = Organization::factory()->create();
    $org2  = Organization::factory()->create();
    makeRule($org1);
    makeRule($org2);

    $this->withToken(autoToken($admin))
        ->getJson("/api/platform/v1/automations?organization_id={$org1->id}")
        ->assertStatus(200)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.organization_id', $org1->id);
});

test('GET /automations filters by is_active', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();
    makeRule($org, ['is_active' => true]);
    makeRule($org, ['is_active' => false]);

    $this->withToken(autoToken($admin))
        ->getJson('/api/platform/v1/automations?is_active=true')
        ->assertStatus(200)
        ->assertJsonPath('total', 1);
});

test('GET /automations/{id} returns single rule', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();
    $rule  = makeRule($org);

    $this->withToken(autoToken($admin))
        ->getJson("/api/platform/v1/automations/{$rule->id}")
        ->assertStatus(200)
        ->assertJsonPath('id', $rule->id)
        ->assertJsonPath('name', 'Test Rule');
});

test('GET /automations/{id} returns 404 for unknown id', function () {
    $admin = autoAdmin();

    $this->withToken(autoToken($admin))
        ->getJson('/api/platform/v1/automations/999999')
        ->assertStatus(404);
});

// ─── POST /automations — create ────────────────────────────────────────────────

test('POST /automations creates rule and logs audit', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();

    $this->withToken(autoToken($admin))
        ->postJson('/api/platform/v1/automations', [
            'organization_id' => $org->id,
            'name'            => 'New Rule',
            'trigger_type'    => 'trial_expiring',
            'action_type'     => 'flag_org',
            'is_active'       => true,
        ])
        ->assertStatus(201)
        ->assertJsonPath('name', 'New Rule')
        ->assertJsonPath('trigger_type', 'trial_expiring');

    expect(AutomationRule::where('name', 'New Rule')->exists())->toBeTrue();
    expect(PlatformAuditLog::where('action', 'automation_rule.created')->exists())->toBeTrue();
});

test('POST /automations is 403 for support role', function () {
    $admin = autoAdmin('support');
    $org   = Organization::factory()->create();

    $this->withToken(autoToken($admin))
        ->postJson('/api/platform/v1/automations', [
            'organization_id' => $org->id,
            'name'            => 'Blocked',
            'trigger_type'    => 'plan_downgrade',
            'action_type'     => 'send_email',
        ])
        ->assertStatus(403);
});

test('POST /automations is 403 for billing role', function () {
    $admin = autoAdmin('billing');
    $org   = Organization::factory()->create();

    $this->withToken(autoToken($admin))
        ->postJson('/api/platform/v1/automations', [
            'organization_id' => $org->id,
            'name'            => 'Blocked',
            'trigger_type'    => 'plan_downgrade',
            'action_type'     => 'send_email',
        ])
        ->assertStatus(403);
});

// ─── PATCH /automations/{id} — update ─────────────────────────────────────────

test('PATCH /automations/{id} updates rule and logs audit', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();
    $rule  = makeRule($org);

    $this->withToken(autoToken($admin))
        ->patchJson("/api/platform/v1/automations/{$rule->id}", [
            'name'      => 'Updated Name',
            'is_active' => false,
        ])
        ->assertStatus(200)
        ->assertJsonPath('name', 'Updated Name')
        ->assertJsonPath('is_active', false);

    expect(PlatformAuditLog::where('action', 'automation_rule.updated')->exists())->toBeTrue();
});

// ─── DELETE /automations/{id} ─────────────────────────────────────────────────

test('DELETE /automations/{id} removes rule and logs audit', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();
    $rule  = makeRule($org);

    $this->withToken(autoToken($admin))
        ->deleteJson("/api/platform/v1/automations/{$rule->id}")
        ->assertStatus(204);

    expect(AutomationRule::find($rule->id))->toBeNull();
    expect(PlatformAuditLog::where('action', 'automation_rule.deleted')->exists())->toBeTrue();
});

// ─── No execute endpoint ───────────────────────────────────────────────────────

test('POST /automations/{id}/run returns 404 — execute endpoint does not exist', function () {
    $admin = autoAdmin();
    $org   = Organization::factory()->create();
    $rule  = makeRule($org);

    $this->withToken(autoToken($admin))
        ->postJson("/api/platform/v1/automations/{$rule->id}/run")
        ->assertStatus(404);
});

// ─── Auth isolation ────────────────────────────────────────────────────────────

test('GET /automations is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/automations')
        ->assertStatus(401);
});

test('POST /automations is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/platform/v1/automations', [])
        ->assertStatus(401);
});
