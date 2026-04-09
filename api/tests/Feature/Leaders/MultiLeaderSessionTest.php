<?php

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSessionWithOrg(): array
{
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status' => 'published',
    ]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);

    return compact('org', 'admin', 'workshop', 'session');
}

function makeOrgLeader(Organization $org): array
{
    $user = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $user->id]);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);

    return compact('user', 'leader');
}

// ─── role_in_session assignment ──────────────────────────────────────────────

test('organizer can assign a leader with a specific role_in_session', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    $response = $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader->id,
        'role_in_session' => 'panelist',
    ]);

    $response->assertStatus(201)
        ->assertJsonFragment(['role_in_session' => 'panelist']);

    $this->assertDatabaseHas('session_leaders', [
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'panelist',
    ]);
});

test('assignment defaults to co_leader when role_in_session is not provided', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    $response = $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader->id,
    ]);

    $response->assertStatus(201)
        ->assertJsonFragment(['role_in_session' => 'co_leader']);
});

test('invalid role_in_session value is rejected with 422', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    $response = $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader->id,
        'role_in_session' => 'guest_star', // invalid
    ]);

    $response->assertStatus(422);
});

// ─── is_primary flag ─────────────────────────────────────────────────────────

test('organizer can assign a primary leader and it sets is_primary=true', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    $response = $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader->id,
        'is_primary' => true,
    ]);

    $response->assertStatus(201)
        ->assertJsonFragment(['is_primary' => true]);
});

test('assigning a new primary leader clears the previous primary flag', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader1] = makeOrgLeader($org);
    ['leader' => $leader2] = makeOrgLeader($org);

    // Assign leader1 as primary
    $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader1->id,
        'is_primary' => true,
    ])->assertStatus(201);

    $this->assertDatabaseHas('session_leaders', ['leader_id' => $leader1->id, 'is_primary' => true]);

    // Assign leader2 as primary — should clear leader1
    $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader2->id,
        'is_primary' => true,
    ])->assertStatus(201);

    $this->assertDatabaseHas('session_leaders', ['leader_id' => $leader1->id, 'is_primary' => false]);
    $this->assertDatabaseHas('session_leaders', ['leader_id' => $leader2->id, 'is_primary' => true]);
});

// ─── assignment_status ───────────────────────────────────────────────────────

test('default assignment_status is accepted', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    $response = $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader->id,
    ]);

    $response->assertStatus(201)
        ->assertJsonFragment(['assignment_status' => 'accepted']);
});

test('organizer can assign a leader with pending status', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    $response = $this->actingAs($admin)->postJson("/api/v1/sessions/{$session->id}/leaders", [
        'leader_id' => $leader->id,
        'assignment_status' => 'pending',
    ]);

    $response->assertStatus(201)
        ->assertJsonFragment(['assignment_status' => 'pending']);
});

// ─── UpdateSessionLeaderStatus (PATCH) ───────────────────────────────────────

test('organizer can update assignment_status to accepted', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'co_leader',
        'assignment_status' => 'pending',
        'is_primary' => false,
    ]);

    $response = $this->actingAs($admin)->patchJson(
        "/api/v1/sessions/{$session->id}/leaders/{$leader->id}",
        ['assignment_status' => 'accepted']
    );

    $response->assertStatus(200)
        ->assertJsonFragment(['assignment_status' => 'accepted']);

    $this->assertDatabaseHas('session_leaders', [
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);
});

test('updating assignment_status to removed is logged to audit_logs', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'co_leader',
        'assignment_status' => 'accepted',
        'is_primary' => false,
    ]);

    $this->actingAs($admin)->patchJson(
        "/api/v1/sessions/{$session->id}/leaders/{$leader->id}",
        ['assignment_status' => 'removed']
    )->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'action' => 'leader_assignment_status_updated',
        'entity_type' => 'session_leader',
    ]);
});

test('invalid assignment_status in PATCH returns 422', function () {
    ['org' => $org, 'admin' => $admin, 'session' => $session] = makeSessionWithOrg();
    ['leader' => $leader] = makeOrgLeader($org);

    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'co_leader',
        'assignment_status' => 'accepted',
        'is_primary' => false,
    ]);

    $this->actingAs($admin)->patchJson(
        "/api/v1/sessions/{$session->id}/leaders/{$leader->id}",
        ['assignment_status' => 'fired'] // invalid
    )->assertStatus(422);
});

// ─── Access control gates respect assignment_status ──────────────────────────

test('leader with pending assignment cannot access roster — returns 403', function () {
    ['org' => $org, 'session' => $session] = makeSessionWithOrg();
    ['user' => $leaderUser, 'leader' => $leader] = makeOrgLeader($org);

    // Assign with pending (not accepted)
    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'co_leader',
        'assignment_status' => 'pending',
        'is_primary' => false,
    ]);

    $this->actingAs($leaderUser)
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertStatus(403);
});

test('leader with pending assignment cannot leader-check-in — returns 403', function () {
    ['org' => $org, 'session' => $session] = makeSessionWithOrg();
    ['user' => $leaderUser, 'leader' => $leader] = makeOrgLeader($org);

    $participant = User::factory()->create();

    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'co_leader',
        'assignment_status' => 'pending',
        'is_primary' => false,
    ]);

    $this->actingAs($leaderUser)
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/leader-check-in")
        ->assertStatus(403);
});

test('leader with accepted assignment can still check in', function () {
    ['org' => $org, 'admin' => $admin, 'workshop' => $workshop, 'session' => $session] = makeSessionWithOrg();
    ['user' => $leaderUser, 'leader' => $leader] = makeOrgLeader($org);

    $participant = User::factory()->create();
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $participant->id,
        'registration_status' => 'registered',
    ]);

    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'role_in_session' => 'co_leader',
        'assignment_status' => 'accepted',
        'is_primary' => false,
    ]);

    $this->actingAs($leaderUser)
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/leader-check-in")
        ->assertStatus(200);
});
