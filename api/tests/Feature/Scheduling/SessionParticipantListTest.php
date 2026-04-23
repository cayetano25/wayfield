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

// ─── Fixture ──────────────────────────────────────────────────────────────────

function listFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $participant = User::factory()->create(['phone_number' => '555-1234']);
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    $selection = SessionSelection::factory()->selfSelected()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    return [$org, $workshop, $owner, $session, $participant, $reg, $selection];
}

// ─── Authorization ────────────────────────────────────────────────────────────

test('owner can view session participant list', function () {
    [, , $owner, $session] = listFixture();

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'total']);
});

test('admin can view session participant list', function () {
    [$org, , , $session] = listFixture();

    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);
});

test('staff can view session participant list', function () {
    [$org, , , $session] = listFixture();

    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $staff->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    $this->actingAs($staff, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);
});

test('assigned leader can view session participant list', function () {
    [$org, , , $session] = listFixture();

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);
});

test('billing_admin cannot view session participant list', function () {
    [$org, , , $session] = listFixture();

    $billing = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $billing->id,
        'role' => 'billing_admin',
        'is_active' => true,
    ]);

    $this->actingAs($billing, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(403);
});

test('participant cannot view session participant list', function () {
    [, , , $session, $participant] = listFixture();

    $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(403);
});

test('unassigned leader cannot view session participant list', function () {
    [, , , $session] = listFixture();

    $leaderUser = User::factory()->create();
    Leader::factory()->create(['user_id' => $leaderUser->id]);
    // No session_leaders row.

    $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(403);
});

test('unauthenticated cannot view participant list', function () {
    [, , , $session] = listFixture();

    $this->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(401);
});

// ─── Response shape ───────────────────────────────────────────────────────────

test('participant list returns expected fields', function () {
    [, , $owner, $session, $participant] = listFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    $first = $response->json('data.0');
    expect($first)->toHaveKey('selection_id');
    expect($first)->toHaveKey('user_id');
    expect($first)->toHaveKey('first_name');
    expect($first)->toHaveKey('last_name');
    expect($first)->toHaveKey('email');
    expect($first)->toHaveKey('assignment_source');
    expect($first)->toHaveKey('check_in_status');
});

test('total count matches selected participants', function () {
    [, , $owner, $session, , ,] = listFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    expect($response->json('total'))->toBe(1);
});

test('canceled selections are not included in the list', function () {
    [$org, $workshop, $owner, $session, $participant, $reg] = listFixture();

    // Existing selection is already in listFixture as selfSelected.
    // Add a canceled selection for a second participant.
    $other = User::factory()->create();
    $otherReg = Registration::factory()->forWorkshop($workshop->id)->forUser($other->id)->create();
    SessionSelection::factory()->canceled()->create([
        'registration_id' => $otherReg->id,
        'session_id' => $session->id,
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    expect($response->json('total'))->toBe(1);
});

// ─── Cross-tenant ─────────────────────────────────────────────────────────────

test('cross-tenant owner cannot view participant list from another org session', function () {
    [, , , $session] = listFixture();

    $orgB = Organization::factory()->create();
    $ownerB = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id' => $ownerB->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $this->actingAs($ownerB, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(403);
});
