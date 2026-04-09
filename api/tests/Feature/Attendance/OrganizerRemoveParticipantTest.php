<?php

use App\Models\AttendanceRecord;
use App\Models\AuditLog;
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

function makeRemoveParticipantFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);

    $participant = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    return [$org, $workshop, $session, $participant, $reg];
}

function makeOrganizerForFixture(Organization $org, string $role = 'owner'): User
{
    $organizer = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $organizer->id,
        'role' => $role,
        'is_active' => true,
    ]);

    return $organizer;
}

// ─── Role: owner ──────────────────────────────────────────────────────────────

test('owner can remove participant from session', function () {
    [$org, $workshop, $session, $participant, $reg] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'owner');

    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Participant removed from session successfully.');

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'canceled',
    ]);

    // Workshop registration must still exist.
    $this->assertDatabaseHas('registrations', [
        'id' => $reg->id,
        'registration_status' => 'registered',
    ]);
});

// ─── Role: admin ──────────────────────────────────────────────────────────────

test('admin can remove participant from session', function () {
    [$org, $workshop, $session, $participant, $reg] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'admin');

    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'canceled',
    ]);
});

// ─── Role: staff ──────────────────────────────────────────────────────────────

test('staff can remove participant from session', function () {
    [$org, $workshop, $session, $participant, $reg] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'staff');

    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'canceled',
    ]);
});

// ─── Role: leader (no org membership) ────────────────────────────────────────

test('leader cannot remove participant from session', function () {
    [$org, $workshop, $session, $participant] = makeRemoveParticipantFixture();

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);
    // No OrganizationUser row — leader has no org membership.

    $this->actingAs($leaderUser, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(403);
});

// ─── Role: billing_admin ──────────────────────────────────────────────────────

test('billing_admin cannot remove participant from session', function () {
    [$org, $workshop, $session, $participant] = makeRemoveParticipantFixture();

    $billingUser = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $billingUser->id,
        'role' => 'billing_admin',
        'is_active' => true,
    ]);

    $this->actingAs($billingUser, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(403);
});

// ─── Attendance reset ─────────────────────────────────────────────────────────

test('removal resets checked-in attendance record', function () {
    [$org, $workshop, $session, $participant] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'owner');

    // Create a checked-in attendance record.
    AttendanceRecord::factory()->checkedIn()->forSession($session->id)->forUser($participant->id)->create();

    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('attendance_records', [
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'not_checked_in',
        'check_in_method' => null,
        'checked_in_by_user_id' => null,
    ]);

    $record = AttendanceRecord::where('session_id', $session->id)
        ->where('user_id', $participant->id)
        ->first();

    expect($record->checked_in_at)->toBeNull();
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('removal writes audit log record', function () {
    [$org, $workshop, $session, $participant] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'owner');

    $auditCountBefore = AuditLog::count();

    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    expect(AuditLog::count())->toBe($auditCountBefore + 1);

    $log = AuditLog::where('action', 'organizer_removed_participant_from_session')->latest()->first();

    expect($log)->not->toBeNull();
    expect($log->action)->toBe('organizer_removed_participant_from_session');
    expect($log->metadata_json['session_id'])->toBe($session->id);
    expect($log->metadata_json['participant_id'])->toBe($participant->id);
});

// ─── Participant not in session ───────────────────────────────────────────────

test('removal of participant not selected in session returns 422', function () {
    [$org, $workshop, $session] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'owner');

    // Different participant who is registered but has not selected this session.
    $otherParticipant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($otherParticipant->id)->create();

    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$otherParticipant->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'This participant is not currently selected for this session.');
});

// ─── Other sessions unaffected ────────────────────────────────────────────────

test('removal does not affect the participant\'s other session selections', function () {
    [$org, $workshop, $session, $participant, $reg] = makeRemoveParticipantFixture();
    $organizer = makeOrganizerForFixture($org, 'owner');

    // Give the participant a second session selection.
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    $selectionB = SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $sessionB->id,
        'selection_status' => 'selected',
    ]);

    // Remove from the first session only.
    $this->actingAs($organizer, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    // First session selection is canceled.
    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'canceled',
    ]);

    // Second session selection is still active.
    $this->assertDatabaseHas('session_selections', [
        'id' => $selectionB->id,
        'selection_status' => 'selected',
    ]);
});

// ─── Cross-tenant boundary ────────────────────────────────────────────────────

test('cross-tenant organizer cannot remove participant from another org\'s session', function () {
    // Org A owns the workshop and session.
    [$orgA, $workshop, $session, $participant] = makeRemoveParticipantFixture();

    // Org B owner has no membership in Org A.
    $orgB = Organization::factory()->create();
    $orgBOwner = makeOrganizerForFixture($orgB, 'owner');

    $this->actingAs($orgBOwner, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(403);
});
