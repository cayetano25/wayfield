<?php

use App\Models\AuditLog;
use App\Models\FeatureFlag;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrgWithRole(string $role): array
{
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->free()->active()->create();

    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);

    return [$org, $user];
}

// ─── Role enforcement ─────────────────────────────────────────────────────────

test('admin cannot set a manual override — must be owner', function () {
    [$org, $admin] = makeOrgWithRole('admin');

    $this->actingAs($admin, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'reporting',
            'is_enabled' => true,
        ])
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'forbidden']);
});

test('staff cannot set a manual override', function () {
    [$org, $staff] = makeOrgWithRole('staff');

    $this->actingAs($staff, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'reporting',
            'is_enabled' => true,
        ])
        ->assertStatus(403);
});

// ─── Owner can set override + audit log ───────────────────────────────────────

test('owner can set a manual override and audit log is created', function () {
    [$org, $owner] = makeOrgWithRole('owner');

    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'reporting',
            'is_enabled' => true,
        ])
        ->assertOk()
        ->assertJsonFragment(['feature_key' => 'reporting'])
        ->assertJsonFragment(['is_enabled' => true])
        ->assertJsonFragment(['source' => 'manual_override']);

    // Verify organization_feature_flags row exists (per-org overrides live here, not feature_flags)
    $this->assertDatabaseHas('organization_feature_flags', [
        'organization_id' => $org->id,
        'feature_key' => 'reporting',
        'is_enabled' => true,
        'source' => 'manual_override',
    ]);

    // Verify audit_logs record created with correct metadata
    $log = AuditLog::where('organization_id', $org->id)
        ->where('action', 'manual_override_set')
        ->where('entity_type', 'feature_flag')
        ->first();

    expect($log)->not->toBeNull();
    expect($log->actor_user_id)->toBe($owner->id);
    expect($log->metadata_json['feature_key'])->toBe('reporting');
    expect($log->metadata_json['is_enabled'])->toBe(true);
    expect($log->metadata_json['organization_id'])->toBe($org->id);
});

test('audit log captures previous_value when updating an existing flag', function () {
    [$org, $owner] = makeOrgWithRole('owner');

    // Pre-create the flag as disabled
    $existingFlag = FeatureFlag::create([
        'organization_id' => $org->id,
        'feature_key' => 'analytics',
        'is_enabled' => false,
        'source' => 'manual_override',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'analytics',
            'is_enabled' => true,
        ])
        ->assertOk();

    $log = AuditLog::where('organization_id', $org->id)
        ->where('action', 'manual_override_set')
        ->where('entity_type', 'feature_flag')
        ->latest('id')
        ->first();

    expect($log->metadata_json['previous_value'])->toBe(false);
    expect($log->metadata_json['is_enabled'])->toBe(true);
});

test('audit log records previous_value as null when flag did not previously exist', function () {
    [$org, $owner] = makeOrgWithRole('owner');

    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'waitlists',
            'is_enabled' => true,
        ])
        ->assertOk();

    $log = AuditLog::where('organization_id', $org->id)
        ->where('action', 'manual_override_set')
        ->first();

    expect($log->metadata_json['previous_value'])->toBeNull();
});

// ─── Manual override affects entitlements ─────────────────────────────────────

test('manual override enabling reporting makes it available on free plan', function () {
    [$org, $owner] = makeOrgWithRole('owner');

    // Without override, free plan has no reporting
    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertStatus(403);

    // Set override
    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'reporting',
            'is_enabled' => true,
        ])
        ->assertOk();

    // Now reporting is accessible
    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk();
});

test('manual override disabling reporting blocks starter plan access', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->starter()->active()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    // Starter can access reporting normally
    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk();

    // Set manual override to disable it
    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [
            'feature_key' => 'reporting',
            'is_enabled' => false,
        ])
        ->assertOk();

    // Now blocked even on Starter
    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertStatus(403);
});

// ─── Validation ───────────────────────────────────────────────────────────────

test('manual override request requires feature_key and is_enabled', function () {
    [$org, $owner] = makeOrgWithRole('owner');

    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$org->id}/feature-flags", [])
        ->assertStatus(422);
});

// ─── Cross-tenant denial ──────────────────────────────────────────────────────

test('owner cannot set override for another organization', function () {
    [$org, $owner] = makeOrgWithRole('owner');

    $otherOrg = Organization::factory()->create();

    $this->actingAs($owner, 'sanctum')
        ->putJson("/api/v1/organizations/{$otherOrg->id}/feature-flags", [
            'feature_key' => 'reporting',
            'is_enabled' => true,
        ])
        ->assertStatus(403);
});
