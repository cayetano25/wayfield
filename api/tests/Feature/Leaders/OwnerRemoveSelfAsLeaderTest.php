<?php

use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function orslOwnerOrg(): array
{
    $org = Organization::factory()->create();
    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    return [$org, $owner];
}

function orslWorkshop(Organization $org): Workshop
{
    return Workshop::factory()->create(['organization_id' => $org->id]);
}

/** Enroll the owner as a leader (with optional workshop) via the HTTP endpoint. */
function orslEnroll(User $owner, Organization $org, ?Workshop $workshop = null): Leader
{
    $payload = $workshop ? ['workshop_id' => $workshop->id] : [];

    test()->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", $payload)
        ->assertStatus(201);

    return Leader::where('user_id', $owner->id)->firstOrFail();
}

// ─── DELETE /organizations/{org}/leaders/self-enroll ──────────────────────────

test('DELETE org self-enroll as owner removes organization_leaders and workshop_leaders but keeps leaders row', function () {
    [$org, $owner] = orslOwnerOrg();
    $workshop = orslWorkshop($org);
    $leader = orslEnroll($owner, $org, $workshop);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(200)
        ->assertJsonPath('message', 'You have been removed as a leader.');

    // leaders row must still exist — only the association is removed
    $this->assertDatabaseHas('leaders', ['id' => $leader->id]);

    $this->assertDatabaseMissing('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
    ]);

    $this->assertDatabaseMissing('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id'   => $leader->id,
    ]);
});

test('DELETE org self-enroll for a staff user who was never enrolled returns 404', function () {
    $org = Organization::factory()->create();
    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $staff->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    // Staff never self-enrolled — no leader record exists
    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(404);
});

test('DELETE org self-enroll when owner has no leader record returns 404', function () {
    [$org, $owner] = orslOwnerOrg();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(404);
});

test('DELETE org self-enroll writes an audit log with action="owner_removed_self_as_leader"', function () {
    [$org, $owner] = orslOwnerOrg();
    orslEnroll($owner, $org);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $owner->id,
        'action'          => 'owner_removed_self_as_leader',
    ]);
});

test('DELETE org self-enroll only removes workshop_leaders for workshops in that org, not in other orgs', function () {
    [$orgA, $owner] = orslOwnerOrg();
    $orgB = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id'         => $owner->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);
    $workshopB = orslWorkshop($orgB);

    // Enroll in both orgs
    orslEnroll($owner, $orgA);
    orslEnroll($owner, $orgB, $workshopB);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    // Remove from org A only
    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$orgA->id}/leaders/self-enroll")
        ->assertStatus(200);

    // Org B workshop link must remain
    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshopB->id,
        'leader_id'   => $leader->id,
    ]);

    // Org B org link must remain
    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $orgB->id,
        'leader_id'       => $leader->id,
    ]);
});

// ─── DELETE /workshops/{workshop}/leaders/self ────────────────────────────────

test('DELETE workshop self removes only that workshop_leaders row, org link remains', function () {
    [$org, $owner] = orslOwnerOrg();
    $workshopA = orslWorkshop($org);
    $workshopB = orslWorkshop($org);

    $leader = orslEnroll($owner, $org, $workshopA);

    // Also enroll in workshop B
    WorkshopLeader::create([
        'workshop_id'   => $workshopB->id,
        'leader_id'     => $leader->id,
        'is_confirmed'  => true,
        'invitation_id' => null,
    ]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshopA->id}/leaders/self")
        ->assertStatus(200)
        ->assertJsonPath('message', 'You have been removed from this workshop.');

    // Workshop A link gone
    $this->assertDatabaseMissing('workshop_leaders', [
        'workshop_id' => $workshopA->id,
        'leader_id'   => $leader->id,
    ]);

    // Workshop B link unaffected
    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshopB->id,
        'leader_id'   => $leader->id,
    ]);

    // Org link unaffected
    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
    ]);
});

test('DELETE workshop self as staff returns 403', function () {
    $org = Organization::factory()->create();
    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $staff->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);
    $workshop = orslWorkshop($org);

    // Give staff a leader record so the 404 branch is bypassed
    Leader::factory()->withUser($staff->id)->create();

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/self")
        ->assertStatus(403);
});

test('DELETE workshop self writes audit log with action="owner_removed_self_from_workshop"', function () {
    [$org, $owner] = orslOwnerOrg();
    $workshop = orslWorkshop($org);
    orslEnroll($owner, $org, $workshop);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/self")
        ->assertStatus(200);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $owner->id,
        'entity_type'     => 'leader',
        'entity_id'       => $leader->id,
        'action'          => 'owner_removed_self_from_workshop',
    ]);
});
