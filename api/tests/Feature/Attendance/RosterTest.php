<?php

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRosterFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create();
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create(['delivery_type' => 'in_person']);

    // Org admin user
    $adminUser = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $adminUser->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    // Participant registered + selected
    $participant = User::factory()->create(['phone_number' => '+15550001111']);
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    return [$org, $workshop, $session, $adminUser, $participant];
}

// ─── Roster Access ────────────────────────────────────────────────────────────

test('org admin can view session roster', function () {
    [, , $session, $adminUser] = makeRosterFixture();

    $this->actingAs($adminUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertOk()
        ->assertJsonStructure(['data' => [['user', 'registration_status', 'attendance']]]);
});

test('org staff can view session roster', function () {
    [$org, , $session] = makeRosterFixture();

    $staffUser = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $staffUser->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    $this->actingAs($staffUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertOk();
});

test('assigned leader can view roster for their session', function () {
    [, , $session] = makeRosterFixture();

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertOk();
});

test('unassigned leader is rejected with 403 from session roster', function () {
    [, , $session] = makeRosterFixture();

    // Leader exists but NOT assigned to this session
    $unrelatedLeaderUser = User::factory()->create();
    Leader::factory()->create(['user_id' => $unrelatedLeaderUser->id]);

    $this->actingAs($unrelatedLeaderUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertStatus(403);
});

test('a participant cannot access the roster — receives 403', function () {
    [, $workshop, $session] = makeRosterFixture();

    $participantUser = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participantUser->id)->create();

    $this->actingAs($participantUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertStatus(403);
});

test('unauthenticated request is rejected from roster', function () {
    [, , $session] = makeRosterFixture();

    $this->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertUnauthorized();
});

// ─── Phone Number Privacy ─────────────────────────────────────────────────────

test('org admin sees participant phone numbers in roster', function () {
    [, , $session, $adminUser, $participant] = makeRosterFixture();

    $response = $this->actingAs($adminUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertOk();

    $entry = collect($response->json()['data'])
        ->firstWhere('user.id', $participant->id);

    expect($entry['user']['phone_number'])->toBe('+15550001111');
});

test('assigned leader sees participant phone numbers in their session roster', function () {
    [, , $session, , $participant] = makeRosterFixture();

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertOk();

    $entry = collect($response->json()['data'])
        ->firstWhere('user.id', $participant->id);

    expect($entry['user']['phone_number'])->toBe('+15550001111');
});

test('cross-tenant leader does not see phone numbers — different org leader cannot access roster', function () {
    // Leader from a different org gets 403 before even seeing phone numbers
    [, , $session] = makeRosterFixture();

    $otherOrg = Organization::factory()->create();
    $outsiderLeader = User::factory()->create();
    Leader::factory()->create(['user_id' => $outsiderLeader->id]);
    // This leader is not assigned to any session in the fixture

    $this->actingAs($outsiderLeader, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertStatus(403);
});

// ─── Attendance Summary ───────────────────────────────────────────────────────

test('org admin can view workshop attendance summary', function () {
    [, $workshop, , $adminUser] = makeRosterFixture();

    $this->actingAs($adminUser, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/attendance-summary")
        ->assertOk()
        ->assertJsonStructure(['workshop_id', 'total_registrations', 'sessions']);
});

test('participant cannot view workshop attendance summary', function () {
    [, $workshop] = makeRosterFixture();

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/attendance-summary")
        ->assertStatus(403);
});
