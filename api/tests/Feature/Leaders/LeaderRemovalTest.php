<?php

use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function removalOrg(): array
{
    $org = Organization::factory()->create();
    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    return [$org, $owner];
}

function removalStaff(Organization $org): User
{
    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $staff->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    return $staff;
}

function pendingInvitation(Organization $org, User $createdBy, ?Workshop $workshop = null): LeaderInvitation
{
    return LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->state([
            'created_by_user_id' => $createdBy->id,
            'workshop_id' => $workshop?->id,
        ])
        ->create();
}

function acceptedLeaderInWorkshop(Organization $org, Workshop $workshop): array
{
    $leader = Leader::factory()->create();
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);
    WorkshopLeader::factory()->confirmed()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);

    return [$leader];
}

// ─── Rescind Invitation ────────────────────────────────────────────────────────

test('owner can rescind a pending invitation', function () {
    [$org, $owner] = removalOrg();
    $invitation = pendingInvitation($org, $owner);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/leader-invitations/{$invitation->id}")
        ->assertOk()
        ->assertJsonPath('status', 'removed');

    $this->assertDatabaseHas('leader_invitations', [
        'id' => $invitation->id,
        'status' => 'removed',
    ]);
});

test('owner can rescind an expired invitation', function () {
    [$org, $owner] = removalOrg();
    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->expired()
        ->state(['created_by_user_id' => $owner->id])
        ->create();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/leader-invitations/{$invitation->id}")
        ->assertOk()
        ->assertJsonPath('status', 'removed');
});

test('rescinding an accepted invitation returns 422 with clear message', function () {
    [$org, $owner] = removalOrg();
    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->accepted()
        ->state(['created_by_user_id' => $owner->id])
        ->create();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/leader-invitations/{$invitation->id}")
        ->assertStatus(422)
        ->assertJsonFragment(['message' => 'This invitation has already been accepted. Use the remove leader action to remove an active leader.']);

    $this->assertDatabaseHas('leader_invitations', [
        'id' => $invitation->id,
        'status' => 'accepted',
    ]);
});

test('rescinding an already rescinded invitation returns 422', function () {
    [$org, $owner] = removalOrg();
    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->state(['created_by_user_id' => $owner->id, 'status' => 'removed'])
        ->create();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/leader-invitations/{$invitation->id}")
        ->assertStatus(422)
        ->assertJsonFragment(['message' => 'Already rescinded.']);
});

test('staff cannot rescind a pending invitation', function () {
    [$org, $owner] = removalOrg();
    $staff = removalStaff($org);
    $invitation = pendingInvitation($org, $owner);

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/leader-invitations/{$invitation->id}")
        ->assertForbidden();
});

test('rescinding a pending invitation writes an audit log', function () {
    [$org, $owner] = removalOrg();
    $invitation = pendingInvitation($org, $owner);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/leader-invitations/{$invitation->id}")
        ->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'leader_invitation',
        'entity_id' => $invitation->id,
        'action' => 'leader_invitation_rescinded',
    ]);
});

// ─── Remove Leader From Workshop ──────────────────────────────────────────────

test('owner can remove an accepted leader from a workshop', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertOk()
        ->assertJsonFragment(['message' => 'Leader removed from workshop.']);

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
        'is_confirmed' => false,
    ]);
});

test('removing a leader clears their session_leaders rows in the workshop', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $session1 = Session::factory()->forWorkshop($workshop->id)->create();
    $session2 = Session::factory()->forWorkshop($workshop->id)->create();
    SessionLeader::factory()->create(['session_id' => $session1->id, 'leader_id' => $leader->id]);
    SessionLeader::factory()->create(['session_id' => $session2->id, 'leader_id' => $leader->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertOk();

    $this->assertDatabaseMissing('session_leaders', ['leader_id' => $leader->id, 'session_id' => $session1->id]);
    $this->assertDatabaseMissing('session_leaders', ['leader_id' => $leader->id, 'session_id' => $session2->id]);
});

test('removing a leader does not delete the workshop_leaders row', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertOk();

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);
});

test('removing a leader marks their accepted invitation as removed', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop($workshop->id)
        ->accepted()
        ->state([
            'created_by_user_id' => $owner->id,
            'leader_id' => $leader->id,
        ])
        ->create();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertOk();

    $this->assertDatabaseHas('leader_invitations', [
        'id' => $invitation->id,
        'status' => 'removed',
    ]);
});

test('staff cannot remove a leader from a workshop', function () {
    [$org, $owner] = removalOrg();
    $staff = removalStaff($org);
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertForbidden();
});

test('removing a leader from a workshop writes an audit log', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'workshop_leader',
        'entity_id' => $leader->id,
        'action' => 'leader_removed_from_workshop',
    ]);
});

test('removing a leader does not affect their global leader profile', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$leader->id}")
        ->assertOk();

    $this->assertDatabaseHas('leaders', ['id' => $leader->id]);
});

test('removing a leader not associated with the workshop returns 404', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    $unrelatedLeader = Leader::factory()->create();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/leaders/{$unrelatedLeader->id}")
        ->assertNotFound();
});

// ─── Remove Leader From Session (confirm existing endpoint) ───────────────────

test('owner can remove a leader from a specific session', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    $session = Session::factory()->forWorkshop($workshop->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/leaders/{$leader->id}")
        ->assertNoContent();

    $this->assertDatabaseMissing('session_leaders', [
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);

    // Workshop association is unaffected
    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);
});

test('removing a leader from a session writes an audit log', function () {
    [$org, $owner] = removalOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    $session = Session::factory()->forWorkshop($workshop->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/leaders/{$leader->id}")
        ->assertNoContent();

    $this->assertDatabaseHas('audit_logs', [
        'action' => 'leader_removed_from_session',
    ]);
});

test('staff cannot remove a leader from a session', function () {
    [$org, $owner] = removalOrg();
    $staff = removalStaff($org);
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    $session = Session::factory()->forWorkshop($workshop->id)->create();
    [$leader] = acceptedLeaderInWorkshop($org, $workshop);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/leaders/{$leader->id}")
        ->assertForbidden();
});
