<?php

use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAttendanceFixture(string $workshopType = 'session_based'): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->create(['workshop_type' => $workshopType]);
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create(['delivery_type' => 'in_person']);

    return [$org, $workshop, $session];
}

function makeAssignedLeader(Session $session): array
{
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);

    return [$leaderUser, $leader];
}

// ─── Self Check-In ────────────────────────────────────────────────────────────

test('registered participant can self-check-in to session_based workshop after selecting session', function () {
    [, $workshop, $session] = makeAttendanceFixture('session_based');

    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertOk()
        ->assertJsonPath('status', 'checked_in');

    $this->assertDatabaseHas('attendance_records', [
        'session_id' => $session->id,
        'user_id' => $user->id,
        'status' => 'checked_in',
        'check_in_method' => 'self',
    ]);
});

test('registered participant can self-check-in to event_based workshop without session selection', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');

    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertOk()
        ->assertJsonPath('status', 'checked_in');
});

test('unregistered participant self-check-in is rejected with 403', function () {
    [, , $session] = makeAttendanceFixture();

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertStatus(403);
});

test('participant without session selection is rejected on session_based workshop', function () {
    [, $workshop, $session] = makeAttendanceFixture('session_based');

    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    // Registered but has NOT selected this session
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertStatus(422)
        ->assertJsonPath('message', 'You must have selected this session to check in.');
});

test('self-check-in is idempotent — second call does not create duplicate record', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');

    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertOk();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertOk();

    $this->assertEquals(
        1,
        AttendanceRecord::where('session_id', $session->id)->where('user_id', $user->id)->count()
    );
});

// ─── Leader Manual Check-In ───────────────────────────────────────────────────

test('assigned leader can manually check in a participant', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');
    [$leaderUser] = makeAssignedLeader($session);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/leader-check-in")
        ->assertOk()
        ->assertJsonPath('status', 'checked_in');

    $this->assertDatabaseHas('attendance_records', [
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'checked_in',
        'check_in_method' => 'leader',
        'checked_in_by_user_id' => $leaderUser->id,
    ]);
});

test('assigned leader can mark participant as no-show', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');
    [$leaderUser] = makeAssignedLeader($session);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/no-show")
        ->assertOk()
        ->assertJsonPath('status', 'no_show');

    $this->assertDatabaseHas('attendance_records', [
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'no_show',
    ]);
});

test('leader NOT assigned to session is rejected with 403 on leader-check-in', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');

    // Unrelated leader — not in session_leaders for this session
    $unrelatedLeaderUser = User::factory()->create();
    Leader::factory()->create(['user_id' => $unrelatedLeaderUser->id]);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($unrelatedLeaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/leader-check-in")
        ->assertStatus(403);
});

test('leader NOT assigned to session is rejected with 403 on no-show', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');

    $unrelatedLeaderUser = User::factory()->create();
    Leader::factory()->create(['user_id' => $unrelatedLeaderUser->id]);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($unrelatedLeaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/no-show")
        ->assertStatus(403);
});

test('a plain user (no leader record) is rejected with 403 on leader-check-in', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');

    $plainUser = User::factory()->create();
    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($plainUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/leader-check-in")
        ->assertStatus(403);
});

// ─── Audit Logging ────────────────────────────────────────────────────────────

test('self-check-in writes an audit log record', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');

    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/check-in")
        ->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $user->id,
        'entity_type' => 'attendance_record',
        'action' => 'self_check_in',
    ]);
});

test('leader check-in writes an audit log record', function () {
    [, $workshop, $session] = makeAttendanceFixture('event_based');
    [$leaderUser] = makeAssignedLeader($session);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/attendance/{$participant->id}/leader-check-in")
        ->assertOk();

    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $leaderUser->id,
        'entity_type' => 'attendance_record',
        'action' => 'leader_check_in',
    ]);
});
