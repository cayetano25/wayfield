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

function enrollOrg(): array
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

function enrollWorkshop(Organization $org): Workshop
{
    return Workshop::factory()->create(['organization_id' => $org->id]);
}

// ─── POST /organizations/{org}/leaders/self-enroll ────────────────────────────

test('owner can self-enroll as a leader without a workshop', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201)
        ->assertJsonPath('message', 'You have been added as a leader.')
        ->assertJsonPath('data.user_id', $owner->id);

    $this->assertDatabaseHas('leaders', ['user_id' => $owner->id]);
    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $org->id,
        'status'          => 'active',
    ]);
});

test('owner can self-enroll with a workshop_id and is confirmed on that workshop', function () {
    [$org, $owner] = enrollOrg();
    $workshop = enrollWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
        ])
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->first();
    expect($leader)->not->toBeNull();

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id'  => $workshop->id,
        'leader_id'    => $leader->id,
        'is_confirmed' => 1,
        'invitation_id' => null,
    ]);
});

test('self-enrollment is idempotent — calling twice does not create duplicates', function () {
    [$org, $owner] = enrollOrg();
    $workshop = enrollWorkshop($org);

    $payload = ['workshop_id' => $workshop->id, 'bio' => 'First call'];

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", $payload)
        ->assertStatus(201);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", $payload)
        ->assertStatus(201);

    expect(Leader::where('user_id', $owner->id)->count())->toBe(1);
    expect(OrganizationLeader::where('organization_id', $org->id)->count())->toBe(1);
    expect(WorkshopLeader::where('workshop_id', $workshop->id)->count())->toBe(1);
});

test('existing leader profile from another org is reused — no second leaders row', function () {
    [$orgA, $owner] = enrollOrg();
    $orgB = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id'         => $owner->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    // Enroll in org A first
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgA->id}/leaders/self-enroll")
        ->assertStatus(201);

    // Enroll in org B — must reuse the same leader record
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgB->id}/leaders/self-enroll")
        ->assertStatus(201);

    expect(Leader::where('user_id', $owner->id)->count())->toBe(1);
    expect(OrganizationLeader::where('leader_id', Leader::where('user_id', $owner->id)->value('id'))->count())->toBe(2);
});

test('owner can include optional profile fields during self-enrollment', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'bio'          => 'Photography instructor.',
            'city'         => 'Austin',
            'display_name' => 'The Photo Guy',
        ])
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->first();
    expect($leader->bio)->toBe('Photography instructor.');
    expect($leader->city)->toBe('Austin');
    expect($leader->display_name)->toBe('The Photo Guy');
});

test('self-enrollment writes an audit log entry', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $owner->id,
        'entity_type'     => 'leader',
        'action'          => 'owner_self_enrolled_as_leader',
    ]);
});

test('admin can self-enroll as a leader', function () {
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $admin->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);
});

test('staff cannot self-enroll as a leader — 403', function () {
    $org = Organization::factory()->create();
    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $staff->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(403);
});

test('billing_admin cannot self-enroll as a leader — 403', function () {
    $org = Organization::factory()->create();
    $billingAdmin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $billingAdmin->id,
        'role'            => 'billing_admin',
        'is_active'       => true,
    ]);

    $this->actingAs($billingAdmin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(403);
});

test('unrelated user cannot self-enroll — 403', function () {
    $org = Organization::factory()->create();
    $outsider = User::factory()->create();

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(403);
});

test('workshop_id from a different organization is rejected', function () {
    [$org, $owner] = enrollOrg();
    $otherOrg = Organization::factory()->create();
    $foreignWorkshop = Workshop::factory()->create(['organization_id' => $otherOrg->id]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $foreignWorkshop->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['workshop_id']);
});

test('response includes is_self_enrolled = true for self-enrolled leader', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201)
        ->assertJsonPath('data.is_self_enrolled', true);
});

// ─── DELETE /organizations/{org}/leaders/self-enroll ──────────────────────────

test('owner can remove themselves as a leader from the organization', function () {
    [$org, $owner] = enrollOrg();
    $workshop = enrollWorkshop($org);

    // Enroll first
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
        ])
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->first();

    // Now remove
    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(200)
        ->assertJsonPath('message', 'You have been removed as a leader.');

    // leaders row must still exist
    $this->assertDatabaseHas('leaders', ['id' => $leader->id]);

    // organization_leaders and workshop_leaders must be gone
    $this->assertDatabaseMissing('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
    ]);
    $this->assertDatabaseMissing('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id'   => $leader->id,
    ]);
});

test('removing self as leader writes an audit log entry', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $owner->id,
        'action'          => 'owner_removed_self_as_leader',
    ]);
});

test('user not enrolled as leader gets 404 on delete', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(404);
});

test('removing self from org does not remove workshop_leaders in other organizations', function () {
    [$orgA, $owner] = enrollOrg();
    $orgB = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id'         => $owner->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);
    $workshopB = enrollWorkshop($orgB);

    // Enroll in both orgs
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgA->id}/leaders/self-enroll")
        ->assertStatus(201);
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgB->id}/leaders/self-enroll", [
            'workshop_id' => $workshopB->id,
        ])
        ->assertStatus(201);

    // Remove only from orgA
    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$orgA->id}/leaders/self-enroll")
        ->assertStatus(200);

    $leader = Leader::where('user_id', $owner->id)->first();

    // orgB workshop link must remain
    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshopB->id,
        'leader_id'   => $leader->id,
    ]);
});

// ─── DELETE /workshops/{workshop}/leaders/self ────────────────────────────────

test('owner can remove themselves from a single workshop without removing from org', function () {
    [$org, $owner] = enrollOrg();
    $workshop = enrollWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
        ])
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->first();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/self")
        ->assertStatus(200)
        ->assertJsonPath('message', 'You have been removed from this workshop.');

    $this->assertDatabaseMissing('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id'   => $leader->id,
    ]);

    // org link must remain
    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
    ]);
});

test('workshop remove writes an audit log entry', function () {
    [$org, $owner] = enrollOrg();
    $workshop = enrollWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
        ])
        ->assertStatus(201);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/self")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $owner->id,
        'action'          => 'owner_removed_self_from_workshop',
    ]);
});

test('staff cannot use the workshop self-remove endpoint — 403', function () {
    $org = Organization::factory()->create();
    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $staff->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);
    $workshop = enrollWorkshop($org);

    // Give them a leader record so they don't hit 404
    Leader::factory()->withUser($staff->id)->create();

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/self")
        ->assertStatus(403);
});

// ─── GET /me — leader_profile fields ─────────────────────────────────────────

test('GET /me includes leader_profile.exists = true after self-enrollment', function () {
    [$org, $owner] = enrollOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $this->actingAs($owner, 'sanctum')
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.exists', true)
        ->assertJsonFragment(['leader_id' => Leader::where('user_id', $owner->id)->value('id')]);
});

test('GET /me includes leader_profile.exists = false when no leader record', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.exists', false)
        ->assertJsonPath('leader_profile.leader_id', null);
});
