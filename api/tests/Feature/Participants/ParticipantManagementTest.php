<?php

use App\Models\AttendanceRecord;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mgmtOrg(): array
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

function mgmtStaff(Organization $org): User
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

function mgmtAdmin(Organization $org): User
{
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    return $admin;
}

function mgmtWorkshopWithParticipant(Organization $org): array
{
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $participant = User::factory()->create();
    $registration = Registration::factory()
        ->forWorkshop($workshop->id)
        ->forUser($participant->id)
        ->create();

    return [$workshop, $participant, $registration];
}

// ─── Remove Participant — Core Behavior ───────────────────────────────────────

test('owner can remove a registered participant from a workshop', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk()
        ->assertJsonFragment(['message' => 'Participant removed.']);

    $this->assertDatabaseHas('registrations', [
        'id' => $registration->id,
        'registration_status' => 'removed',
        'removed_by_user_id' => $owner->id,
    ]);
    $this->assertDatabaseHas('registrations', [
        'id' => $registration->id,
    ]);
    expect(Registration::find($registration->id)->removed_at)->not->toBeNull();
});

test('admin can remove a registered participant', function () {
    [$org, $owner] = mgmtOrg();
    $admin = mgmtAdmin($org);
    [$workshop, $participant] = mgmtWorkshopWithParticipant($org);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk();
});

test('removal stores optional reason on the registration', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}", [
            'reason' => 'No-show history',
        ])
        ->assertOk();

    $this->assertDatabaseHas('registrations', [
        'id' => $registration->id,
        'removal_reason' => 'No-show history',
    ]);
});

test('removed participant keeps their Wayfield account', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant] = mgmtWorkshopWithParticipant($org);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk();

    $this->assertDatabaseHas('users', ['id' => $participant->id]);
});

// ─── Session Selections ───────────────────────────────────────────────────────

test('removing a participant cancels all their session selections in the workshop', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);

    $session1 = Session::factory()->forWorkshop($workshop->id)->create();
    $session2 = Session::factory()->forWorkshop($workshop->id)->create();
    $sel1 = SessionSelection::factory()->create(['registration_id' => $registration->id, 'session_id' => $session1->id]);
    $sel2 = SessionSelection::factory()->create(['registration_id' => $registration->id, 'session_id' => $session2->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk();

    $this->assertDatabaseHas('session_selections', ['id' => $sel1->id, 'selection_status' => 'canceled']);
    $this->assertDatabaseHas('session_selections', ['id' => $sel2->id, 'selection_status' => 'canceled']);
});

// ─── Attendance Records ───────────────────────────────────────────────────────

test('removing a participant marks not-checked-in attendance records as no_show', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);
    $session = Session::factory()->forWorkshop($workshop->id)->create();
    AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'not_checked_in',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk();

    $this->assertDatabaseHas('attendance_records', [
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'no_show',
    ]);
});

test('already checked-in attendance records are preserved on participant removal', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);
    $session = Session::factory()->forWorkshop($workshop->id)->create();
    AttendanceRecord::factory()->checkedIn()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
    ]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk();

    $this->assertDatabaseHas('attendance_records', [
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'checked_in',
    ]);
});

// ─── Error Cases ──────────────────────────────────────────────────────────────

test('removing an already-removed participant returns 422', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);
    $registration->update(['registration_status' => 'removed', 'removed_at' => now()]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertStatus(422)
        ->assertJsonFragment(['message' => 'Participant is already removed.']);
});

test('removing a participant not registered in the workshop returns 404', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $stranger = User::factory()->create();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$stranger->id}")
        ->assertNotFound();
});

// ─── Authorization ────────────────────────────────────────────────────────────

test('staff cannot remove a participant from a workshop', function () {
    [$org, $owner] = mgmtOrg();
    $staff = mgmtStaff($org);
    [$workshop, $participant] = mgmtWorkshopWithParticipant($org);

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertForbidden();
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

test('participant removal writes an audit log', function () {
    [$org, $owner] = mgmtOrg();
    [$workshop, $participant, $registration] = mgmtWorkshopWithParticipant($org);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/participants/{$participant->id}")
        ->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'registration',
        'entity_id' => $registration->id,
        'action' => 'participant_removed',
    ]);
});

// ─── Join Code Rotation ───────────────────────────────────────────────────────

test('owner can rotate the workshop join code', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['join_code' => 'OLDCODE1']);

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertOk()
        ->assertJsonStructure(['join_code']);

    $newCode = $response->json('join_code');
    expect($newCode)->not->toBe('OLDCODE1');
    expect(strlen($newCode))->toBe(8);
});

test('old join code no longer works after rotation', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['join_code' => 'ROTTEST1']);
    $participant = User::factory()->create();

    // Rotate the code.
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertOk();

    // Attempting to join with the old code should fail (404 — code not found).
    $this->actingAs($participant, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'ROTTEST1'])
        ->assertStatus(404);
});

test('new join code is persisted on the workshop', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['join_code' => 'PERSIST1']);

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertOk();

    $newCode = $response->json('join_code');
    $this->assertDatabaseHas('workshops', ['id' => $workshop->id, 'join_code' => $newCode]);
    $this->assertDatabaseMissing('workshops', ['id' => $workshop->id, 'join_code' => 'PERSIST1']);
});

test('rotation records join_code_rotated_at and rotated_by on the workshop', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertOk();

    $workshop->refresh();
    expect($workshop->join_code_rotated_at)->not->toBeNull();
    expect($workshop->join_code_rotated_by_user_id)->toBe($owner->id);
});

test('existing registered participants are unaffected by code rotation', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $participant = User::factory()->create();
    $registration = Registration::factory()
        ->forWorkshop($workshop->id)
        ->forUser($participant->id)
        ->create();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertOk();

    $this->assertDatabaseHas('registrations', [
        'id' => $registration->id,
        'registration_status' => 'registered',
    ]);
});

test('rotation audit log does not contain join code values', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['join_code' => 'SECRET01']);

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertOk();

    $newCode = $response->json('join_code');

    $log = AuditLog::where('action', 'join_code_rotated')->latest()->first();
    expect($log)->not->toBeNull();

    $metadataJson = json_encode($log->metadata_json);
    expect(str_contains($metadataJson, 'SECRET01'))->toBeFalse();
    expect(str_contains($metadataJson, $newCode))->toBeFalse();
});

test('staff cannot rotate the join code', function () {
    [$org, $owner] = mgmtOrg();
    $staff = mgmtStaff($org);
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/rotate-join-code")
        ->assertForbidden();
});

// ─── Participant List (GET /workshops/{workshop}/participants) ─────────────────

test('participant list returns joined_via_code as a boolean', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['join_code' => 'LISTTEST']);
    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create([
        'joined_via_code' => 'LISTTEST',
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/participants")
        ->assertOk();

    expect($response->json('0.joined_via_code'))->toBeTrue();
});

test('participant list returns joined_via_code false when registered without a code', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create([
        'joined_via_code' => null,
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/participants")
        ->assertOk();

    expect($response->json('0.joined_via_code'))->toBeFalse();
});

test('participant list includes waitlisted registrations', function () {
    [$org, $owner] = mgmtOrg();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create([
        'registration_status' => 'waitlisted',
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/participants")
        ->assertOk();

    expect($response->json())->toHaveCount(1);
    expect($response->json('0.registration_status'))->toBe('waitlisted');
});
