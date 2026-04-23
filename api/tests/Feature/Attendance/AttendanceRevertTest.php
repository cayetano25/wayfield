<?php

use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRevertFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->create(['workshop_type' => 'event_based']);
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create(['delivery_type' => 'in_person']);

    return [$org, $workshop, $session];
}

function makeRevertLeader(Session $session): array
{
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);

    return [$leaderUser, $leader];
}

function makeCheckedInRecord(Session $session, Workshop $workshop): array
{
    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    $record = AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'checked_in',
        'check_in_method' => 'leader',
        'checked_in_at' => now(),
    ]);

    return [$participant, $record];
}

// ─── Successful revert ────────────────────────────────────────────────────────

test('assigned leader can revert a checked_in attendance record', function () {
    [$org, $workshop, $session] = makeRevertFixture();
    [$leaderUser] = makeRevertLeader($session);
    [$participant, $record] = makeCheckedInRecord($session, $workshop);

    $this->actingAs($leaderUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertOk()
        ->assertJsonPath('status', 'not_checked_in')
        ->assertJsonPath('check_in_method', null)
        ->assertJsonPath('checked_in_at', null);

    $this->assertDatabaseHas('attendance_records', [
        'id' => $record->id,
        'status' => 'not_checked_in',
        'check_in_method' => null,
        'checked_in_at' => null,
        'checked_in_by_user_id' => null,
    ]);
});

test('organizer (owner) can revert a checked_in attendance record', function () {
    [$org, $workshop, $session] = makeRevertFixture();

    $orgOwner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $orgOwner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    [$participant, $record] = makeCheckedInRecord($session, $workshop);

    $this->actingAs($orgOwner, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertOk()
        ->assertJsonPath('status', 'not_checked_in');
});

// ─── Wrong status rejection ────────────────────────────────────────────────────

test('revert is rejected with 422 when attendance status is not_checked_in', function () {
    [$org, $workshop, $session] = makeRevertFixture();
    [$leaderUser] = makeRevertLeader($session);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'not_checked_in',
    ]);

    $this->actingAs($leaderUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertStatus(422);
});

test('assigned leader can revert a no_show attendance record', function () {
    [$org, $workshop, $session] = makeRevertFixture();
    [$leaderUser] = makeRevertLeader($session);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    $record = AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'no_show',
        'check_in_method' => 'leader',
        'checked_in_by_user_id' => $leaderUser->id,
    ]);

    $this->actingAs($leaderUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertOk()
        ->assertJsonPath('status', 'not_checked_in')
        ->assertJsonPath('check_in_method', null)
        ->assertJsonPath('checked_in_at', null);

    $this->assertDatabaseHas('attendance_records', [
        'id' => $record->id,
        'status' => 'not_checked_in',
        'check_in_method' => null,
        'checked_in_at' => null,
        'checked_in_by_user_id' => null,
    ]);
});

test('revert is rejected with 422 when no attendance record exists', function () {
    [$org, $workshop, $session] = makeRevertFixture();
    [$leaderUser] = makeRevertLeader($session);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($leaderUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertStatus(422);
});

// ─── Authorization rejection ──────────────────────────────────────────────────

test('unassigned leader is rejected with 403 on revert', function () {
    [$org, $workshop, $session] = makeRevertFixture();

    $unrelatedLeaderUser = User::factory()->create();
    Leader::factory()->create(['user_id' => $unrelatedLeaderUser->id]);

    [$participant] = makeCheckedInRecord($session, $workshop);

    $this->actingAs($unrelatedLeaderUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertStatus(403);
});

test('plain participant is rejected with 403 on revert', function () {
    [$org, $workshop, $session] = makeRevertFixture();

    $plainUser = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($plainUser->id)->create();

    [$participant] = makeCheckedInRecord($session, $workshop);

    $this->actingAs($plainUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertStatus(403);
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('revert writes an audit_log record', function () {
    [$org, $workshop, $session] = makeRevertFixture();
    [$leaderUser] = makeRevertLeader($session);
    [$participant] = makeCheckedInRecord($session, $workshop);

    $this->actingAs($leaderUser, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/revert")
        ->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $leaderUser->id,
        'entity_type' => 'attendance_record',
        'action' => 'attendance_reverted',
    ]);
});
