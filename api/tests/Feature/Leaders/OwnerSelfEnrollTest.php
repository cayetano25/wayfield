<?php

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

function oseOwnerOrg(): array
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

function oseAdminOrg(): array
{
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $admin->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    return [$org, $admin];
}

function oseWorkshop(Organization $org): Workshop
{
    return Workshop::factory()->create(['organization_id' => $org->id]);
}

// ─── POST — happy paths ───────────────────────────────────────────────────────

test('POST as owner with bio returns 201 and includes bio in response', function () {
    [$org, $owner] = oseOwnerOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'bio' => 'Street photographer based in NYC.',
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.bio', 'Street photographer based in NYC.')
        ->assertJsonPath('message', 'You have been added as a leader.');
});

test('POST as admin returns 201 — admin has same self-enrollment rights as owner', function () {
    [$org, $admin] = oseAdminOrg();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $this->assertDatabaseHas('leaders', ['user_id' => $admin->id]);
});

test('POST with workshop_id in the same org returns 201 and creates confirmed workshop_leaders row', function () {
    [$org, $owner] = oseOwnerOrg();
    $workshop = oseWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
        ])
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id'   => $workshop->id,
        'leader_id'     => $leader->id,
        'is_confirmed'  => true,
        'invitation_id' => null,
    ]);
});

test('POST twice by the same owner does not create duplicate rows and updates profile', function () {
    [$org, $owner] = oseOwnerOrg();
    $workshop = oseWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
            'bio'         => 'First bio.',
        ])
        ->assertStatus(201);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
            'bio'         => 'Updated bio.',
        ])
        ->assertStatus(201);

    // No duplicate rows
    expect(Leader::where('user_id', $owner->id)->count())->toBe(1);
    expect(OrganizationLeader::where('organization_id', $org->id)->count())->toBe(1);
    expect(WorkshopLeader::where('workshop_id', $workshop->id)->count())->toBe(1);

    // Profile was updated
    $leader = Leader::where('user_id', $owner->id)->first();
    expect($leader->bio)->toBe('Updated bio.');
});

test('POST by user who already has a leaders profile from another org reuses the same leader_id', function () {
    [$orgA, $owner] = oseOwnerOrg();
    $orgB = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id'         => $owner->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    // First enroll in org A
    $responseA = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgA->id}/leaders/self-enroll")
        ->assertStatus(201)
        ->json('data.id');

    // Enroll in org B — must return the same leader id
    $responseB = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgB->id}/leaders/self-enroll")
        ->assertStatus(201)
        ->json('data.id');

    expect($responseA)->toBe($responseB);
    expect(Leader::where('user_id', $owner->id)->count())->toBe(1);
});

test('POST returns is_self_enrolled=true on the leader resource', function () {
    [$org, $owner] = oseOwnerOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201)
        ->assertJsonPath('data.is_self_enrolled', true);
});

// ─── POST — authorization rejections ──────────────────────────────────────────

test('POST as staff returns 403', function () {
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

test('POST unauthenticated returns 401', function () {
    $org = Organization::factory()->create();

    $this->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(401);
});

test('POST as owner of a DIFFERENT organization returns 403', function () {
    [$orgA, $ownerA] = oseOwnerOrg();
    [$orgB] = oseOwnerOrg();

    // ownerA is owner of orgA but has no membership in orgB
    $this->actingAs($ownerA, 'sanctum')
        ->postJson("/api/v1/organizations/{$orgB->id}/leaders/self-enroll")
        ->assertStatus(403);
});

// ─── POST — validation ────────────────────────────────────────────────────────

test('POST with workshop_id from a different organization returns 422', function () {
    [$org, $owner] = oseOwnerOrg();
    $otherOrg = Organization::factory()->create();
    $foreignWorkshop = Workshop::factory()->create(['organization_id' => $otherOrg->id]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $foreignWorkshop->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['workshop_id'])
        ->assertJsonFragment(['The selected workshop does not belong to this organization.']);
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

test('GET /me after self-enrollment includes leader_profile.exists=true and the correct leader_id', function () {
    [$org, $owner] = oseOwnerOrg();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $leaderId = Leader::where('user_id', $owner->id)->value('id');

    $this->actingAs($owner, 'sanctum')
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.exists', true)
        ->assertJsonPath('leader_profile.leader_id', $leaderId);
});

test('GET /me for a user with no leader profile returns exists=false and leader_id=null', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.exists', false)
        ->assertJsonPath('leader_profile.leader_id', null);
});

// ─── GET /organizations/{org}/leaders ─────────────────────────────────────────

test('GET /organizations/{org}/leaders includes the self-enrolled owner in the list', function () {
    [$org, $owner] = oseOwnerOrg();

    // Self-enroll the owner
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $leaderId = Leader::where('user_id', $owner->id)->value('id');

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/leaders")
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id')->toArray();
    expect($ids)->toContain($leaderId);
});
