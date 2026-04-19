<?php

use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Shared fixture helper ────────────────────────────────────────────────────

function makeSelectionFixture(string $workshopType = 'session_based'): array
{
    $org = Organization::factory()->create();
    $method = $workshopType === 'session_based' ? 'sessionBased' : 'eventBased';
    $workshop = Workshop::factory()->{$method}()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    return [$org, $workshop, $user, $reg];
}

// ─── TASK 1: GET /selection-options ──────────────────────────────────────────

test('selection-options returns sessions grouped by day', function () {
    [, $workshop, $user] = makeSelectionFixture();

    // Two sessions on different days (UTC midnight in NY = previous day in UTC)
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 14:00:00', // 10 AM NY
        'end_at' => '2026-09-01 16:00:00',
    ]);
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-02 14:00:00', // 10 AM NY day 2
        'end_at' => '2026-09-02 16:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    expect($response->json('days'))->toHaveCount(2);
    expect($response->json('workshop.workshop_type'))->toBe('session_based');
    expect($response->json('selection_summary.total_selectable'))->toBe(2);
});

test('selection-options requires registration in the workshop', function () {
    [, $workshop] = makeSelectionFixture();
    $outsider = User::factory()->create();

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(403);
});

test('selection-options marks selected sessions as state=selected', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $sessionData = findSessionInOptions($response, $session->id);
    expect($sessionData['state'])->toBe('selected');
    expect($response->json('selected_session_ids'))->toContain($session->id);
});

test('selection-options marks conflicting sessions as state=conflicted with conflict_with populated', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    // Session A: 10:00–12:00 NY (selected by user)
    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'title' => 'Morning Walk',
        'start_at' => '2026-09-01 14:00:00', // 10 AM NY
        'end_at' => '2026-09-01 16:00:00',   // 12 PM NY
    ]);

    // Session B: 11:00–13:00 NY (overlaps A)
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 15:00:00', // 11 AM NY
        'end_at' => '2026-09-01 17:00:00',   // 1 PM NY
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $sessionA->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $sessionBData = findSessionInOptions($response, $sessionB->id);
    expect($sessionBData['state'])->toBe('conflicted');
    expect($sessionBData['conflict_with']['session_id'])->toBe($sessionA->id);
    expect($sessionBData['conflict_with']['title'])->toBe('Morning Walk');

    // Session A itself is 'selected', not 'conflicted'
    $sessionAData = findSessionInOptions($response, $sessionA->id);
    expect($sessionAData['state'])->toBe('selected');

    // has_conflicts flag
    expect($response->json('selection_summary.has_conflicts'))->toBeTrue();
});

test('selection-options marks full sessions as state=full', function () {
    [, $workshop, $user] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->withCapacity(1)->published()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    // Another user fills the slot
    $otherUser = User::factory()->create();
    $otherReg = Registration::factory()->forWorkshop($workshop->id)->forUser($otherUser->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $otherReg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $sessionData = findSessionInOptions($response, $session->id);
    expect($sessionData['state'])->toBe('full');
    expect($sessionData['spots_remaining'])->toBe(0);
});

test('selection-options returns correct spots_remaining', function () {
    [, $workshop, $user] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->withCapacity(5)->published()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    // Fill 3 of 5 slots
    for ($i = 0; $i < 3; $i++) {
        $u = User::factory()->create();
        $r = Registration::factory()->forWorkshop($workshop->id)->forUser($u->id)->create();
        SessionSelection::factory()->create([
            'registration_id' => $r->id,
            'session_id' => $session->id,
            'selection_status' => 'selected',
        ]);
    }

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $sessionData = findSessionInOptions($response, $session->id);
    expect($sessionData['enrolled_count'])->toBe(3);
    expect($sessionData['spots_remaining'])->toBe(2);
    expect($sessionData['state'])->toBe('available');
});

test('selection-options is_parallel true when two sessions share a start time', function () {
    [, $workshop, $user] = makeSelectionFixture();

    // Two sessions that start at the same time (parallel options)
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);
    // One session at a different time
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $day = $response->json('days.0');
    // Find the slot with 2 sessions
    $parallelSlot = collect($day['time_slots'])->firstWhere('is_parallel', true);
    expect($parallelSlot)->not->toBeNull();
    expect($parallelSlot['sessions'])->toHaveCount(2);

    // The solo session slot is not parallel
    $soloSlot = collect($day['time_slots'])->firstWhere('is_parallel', false);
    expect($soloSlot['sessions'])->toHaveCount(1);
});

test('selection-options spots_remaining is null for unlimited sessions', function () {
    [, $workshop, $user] = makeSelectionFixture();

    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'capacity' => null,
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $sessionData = collect($response->json('days.0.time_slots.0.sessions'))->first();
    expect($sessionData['spots_remaining'])->toBeNull();
    expect($sessionData['state'])->toBe('available');
});

// ─── TASK 2: POST /selections ────────────────────────────────────────────────

test('POST selections creates a session_selection row', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    expect($response->json('selection.session_id'))->toBe($session->id);
    expect($response->json('selection.title'))->toBe($session->title);
    expect($response->json('updated_summary.total_selected'))->toBe(1);
});

test('POST selections is idempotent — selecting twice returns 200 not 422', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    // Second attempt must return 200, not 201 or 422.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(200);

    // Still exactly one row.
    $this->assertEquals(
        1,
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->count()
    );
});

test('POST selections rejects when session conflicts with existing selection', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'title' => 'Morning Portraits',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 11:00:00',
    ]);
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 10:00:00',
        'end_at' => '2026-09-01 12:00:00',
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $sessionA->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(422);

    // Structured conflict error
    expect($response->json('error'))->toBe('time_conflict');
    expect($response->json('conflict_with.session_id'))->toBe($sessionA->id);
    expect($response->json('conflict_with.title'))->toBe('Morning Portraits');
    expect($response->json('conflict_with.start_display'))->not->toBeNull();
    expect($response->json('conflict_with.end_display'))->not->toBeNull();
});

test('POST selections rejects when session is full', function () {
    [, $workshop, $user] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->withCapacity(1)->published()->create([
        'title' => 'Full Session',
    ]);

    // Fill the slot
    $otherUser = User::factory()->create();
    $otherReg = Registration::factory()->forWorkshop($workshop->id)->forUser($otherUser->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $otherReg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('session_full');
    expect($response->json('session_title'))->toBe('Full Session');
});

test('POST selections rejects for event_based workshops', function () {
    [, $workshop, $user] = makeSelectionFixture('event_based');

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('event_based_workshop');
});

test('POST selections rejects for non-registered participant', function () {
    [, $workshop] = makeSelectionFixture();
    $outsider = User::factory()->create();
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(403);
});

test('POST selections rejects for unpublished session', function () {
    [, $workshop, $user] = makeSelectionFixture();

    $unpublished = Session::factory()->forWorkshop($workshop->id)->create([
        'is_published' => false,
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $unpublished->id])
        ->assertStatus(422);
});

// ─── TASK 3: DELETE /selections/{session} ────────────────────────────────────

test('DELETE selections deselects a session', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'canceled',
    ]);

    expect($response->json('updated_summary.total_selected'))->toBe(0);
    expect($response->json('message'))->toBe('Session removed from your schedule.');
});

test('DELETE selections returns 422 if participant already checked in', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    AttendanceRecord::factory()->checkedIn()->forSession($session->id)->forUser($user->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(422);

    expect($response->json('error'))->toBe('already_checked_in');
    expect($response->json('message'))->toContain('checked into');
});

test('DELETE selections returns 404 if no selection exists', function () {
    [, $workshop, $user] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    // No selection row created — should get 404.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(404);
});

// ─── TASK 4: GET /my-selections ──────────────────────────────────────────────

test('GET my-selections returns only this user\'s selected sessions ordered by start_at', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $sessionLater = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);
    $sessionEarlier = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);
    $sessionUnselected = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => '2026-09-01 20:00:00',
        'end_at' => '2026-09-01 22:00:00',
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $sessionLater->id,
        'selection_status' => 'selected',
    ]);
    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $sessionEarlier->id,
        'selection_status' => 'selected',
    ]);
    // sessionUnselected is not selected — must not appear.

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-selections")
        ->assertStatus(200);

    $sessions = $response->json('selected_sessions');
    expect($sessions)->toHaveCount(2);
    expect($response->json('total_selected'))->toBe(2);

    // Ordered by start_at ASC — earlier session first.
    expect($sessions[0]['session_id'])->toBe($sessionEarlier->id);
    expect($sessions[1]['session_id'])->toBe($sessionLater->id);

    // Must not contain the unselected session.
    $ids = collect($sessions)->pluck('session_id');
    expect($ids)->not->toContain($sessionUnselected->id);

    // Response shape check.
    $first = $sessions[0];
    expect($first)->toHaveKey('start_display');
    expect($first)->toHaveKey('end_display');
    expect($first)->toHaveKey('day_label');
    expect($first)->toHaveKey('day_short');
    expect($first)->toHaveKey('leaders');
});

test('GET my-selections returns empty array when no sessions selected', function () {
    [, $workshop, $user] = makeSelectionFixture();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-selections")
        ->assertStatus(200);

    expect($response->json('selected_sessions'))->toHaveCount(0);
    expect($response->json('total_selected'))->toBe(0);
});

test('GET my-selections excludes canceled selections', function () {
    [, $workshop, $user, $reg] = makeSelectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    SessionSelection::factory()->canceled()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-selections")
        ->assertStatus(200);

    expect($response->json('selected_sessions'))->toHaveCount(0);
});

test('GET my-selections requires registration', function () {
    [, $workshop] = makeSelectionFixture();
    $outsider = User::factory()->create();

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-selections")
        ->assertStatus(403);
});

// ─── Helper: navigate the grouped response structure ─────────────────────────

/**
 * Find a specific session's data inside the selection-options response days array.
 */
function findSessionInOptions($response, int $sessionId): ?array
{
    return collect($response->json('days'))
        ->flatMap(fn ($d) => collect($d['time_slots'])->flatMap(fn ($ts) => $ts['sessions']))
        ->firstWhere('session_id', $sessionId);
}
