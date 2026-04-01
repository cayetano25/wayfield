<?php

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupSessionAssignmentFixture(): array
{
    $org    = Organization::factory()->create();
    $admin  = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $admin->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $session  = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $leader = Leader::factory()->create();
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);

    return [$org, $admin, $workshop, $session, $leader];
}

// ─── Assign ───────────────────────────────────────────────────────────────────

test('organizer can assign a leader to a session', function () {
    [$org, $admin, $workshop, $session, $leader] = setupSessionAssignmentFixture();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/leaders", [
            'leader_id'  => $leader->id,
            'role_label' => 'Lead Instructor',
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('session_leaders', [
        'session_id' => $session->id,
        'leader_id'  => $leader->id,
        'role_label' => 'Lead Instructor',
    ]);
});

test('assigning same leader twice is idempotent', function () {
    [$org, $admin, $workshop, $session, $leader] = setupSessionAssignmentFixture();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/leaders", ['leader_id' => $leader->id])
        ->assertStatus(201);

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/leaders", ['leader_id' => $leader->id])
        ->assertStatus(201);

    expect(SessionLeader::where('session_id', $session->id)->where('leader_id', $leader->id)->count())->toBe(1);
});

test('cannot assign a leader not in the organization', function () {
    [$org, $admin, $workshop, $session, $_] = setupSessionAssignmentFixture();

    // A different leader not linked to this org
    $outsideLeader = Leader::factory()->create();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/leaders", [
            'leader_id' => $outsideLeader->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Leader is not an active member of this organization and cannot be assigned to sessions.');
});

test('non-admin cannot assign leaders to sessions', function () {
    [$org, $admin, $workshop, $session, $leader] = setupSessionAssignmentFixture();

    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $staff->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/leaders", ['leader_id' => $leader->id])
        ->assertStatus(403);
});

// ─── Remove ───────────────────────────────────────────────────────────────────

test('organizer can remove a leader from a session', function () {
    [$org, $admin, $workshop, $session, $leader] = setupSessionAssignmentFixture();

    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id'  => $leader->id,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/leaders/{$leader->id}")
        ->assertStatus(204);

    $this->assertDatabaseMissing('session_leaders', [
        'session_id' => $session->id,
        'leader_id'  => $leader->id,
    ]);
});

test('removing session leader is logged to audit_logs', function () {
    [$org, $admin, $workshop, $session, $leader] = setupSessionAssignmentFixture();

    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id'  => $leader->id,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/leaders/{$leader->id}")
        ->assertStatus(204);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $admin->id,
        'entity_type'     => 'session_leader',
        'action'          => 'leader_removed_from_session',
    ]);
});

// ─── Leader access enforcement ────────────────────────────────────────────────

test('leader not assigned to a session cannot view its leaders list', function () {
    $org    = Organization::factory()->create();
    $user   = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
    ]);

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $session  = Session::factory()->forWorkshop($workshop->id)->published()->create();

    // user is a leader but not an org member via organization_users, so they cannot view sessions
    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/leaders")
        ->assertStatus(403);
});

// ─── Acceptance criterion 11 (Phase 5) ───────────────────────────────────────
//
// "Leader without session assignment cannot access any roster."
//
// The session_leaders table is the authoritative gate for roster access,
// phone number visibility, and leader messaging scope. The Phase 4 assignment
// tests above verify that the table is populated and enforced correctly.
//
// The participant roster endpoint (GET /api/v1/sessions/{session}/roster)
// is built in Phase 5 and will use the following check:
//
//   $isAssignedLeader = SessionLeader::where('session_id', $session->id)
//       ->where('leader_id', $leader->id)
//       ->exists();
//   if (! $isAssignedLeader && ! $isOrgStaffOrAbove) abort(403);
//
// The test for this criterion lives in tests/Feature/Attendance/ (Phase 5).

test('assignment creates audit_log entry', function () {
    [$org, $admin, $workshop, $session, $leader] = setupSessionAssignmentFixture();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/leaders", [
            'leader_id' => $leader->id,
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $admin->id,
        'entity_type'     => 'session_leader',
        'action'          => 'leader_assigned_to_session',
    ]);
});
