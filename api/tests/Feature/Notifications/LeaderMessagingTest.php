<?php

use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * IMPORTANT: All time-window tests use America/Chicago (UTC-5/UTC-6).
 * A test that passes with UTC-only time will ALSO pass with broken timezone logic.
 * Using a non-UTC timezone ensures the implementation is correct.
 *
 * America/Chicago is UTC-6 in winter (CST) and UTC-5 in summer (CDT).
 * We pin our test dates to a specific CST date to eliminate DST ambiguity.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a fixture for leader messaging tests.
 *
 * Session timing uses America/Chicago.
 * The session is pinned to a weekday in January (CST = UTC-6).
 *
 * Session start: 2026-01-15 10:00 CST = 2026-01-15 16:00 UTC
 * Session end:   2026-01-15 12:00 CST = 2026-01-15 18:00 UTC
 * Window start:  2026-01-15 06:00 CST = 2026-01-15 12:00 UTC
 * Window end:    2026-01-15 14:00 CST = 2026-01-15 20:00 UTC
 */
function makeMessagingFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => 'America/Chicago']);

    // start_at and end_at stored as UTC datetimes.
    // Session runs 10:00–12:00 CST on 2026-01-15 → 16:00–18:00 UTC.
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'delivery_type' => 'in_person',
            'start_at' => '2026-01-15 16:00:00', // 10:00 CST
            'end_at' => '2026-01-15 18:00:00', // 12:00 CST
        ]);

    // Assigned leader
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);

    // Participant
    $participant = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    return [$org, $workshop, $session, $leaderUser, $leader, $participant];
}

/**
 * Freeze time to a specific UTC value for tests.
 */
function freezeAt(string $utcDatetime): void
{
    Carbon::setTestNow(Carbon::parse($utcDatetime, 'UTC'));
}

// ─── Rejection: missing session_id ────────────────────────────────────────────

test('leader notification without session_id is rejected with 422', function () {
    [, $workshop, , $leaderUser] = makeMessagingFixture();

    freezeAt('2026-01-15 17:00:00'); // inside window so only the missing field matters

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title' => 'Heads up',
            'message' => 'See you soon!',
            'notification_type' => 'informational',
            // session_id intentionally omitted
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['session_id']);

    Carbon::setTestNow();
});

// ─── Rejection: leader not assigned to session ────────────────────────────────

test('leader NOT assigned to session is rejected with 403', function () {
    [, $workshop, $session] = makeMessagingFixture();

    // Unrelated leader — no session_leaders row for this session
    $unrelatedLeaderUser = User::factory()->create();
    Leader::factory()->create(['user_id' => $unrelatedLeaderUser->id]);

    // Freeze inside the window
    freezeAt('2026-01-15 17:00:00'); // 11:00 CST — inside window

    $this->actingAs($unrelatedLeaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Hi',
            'message' => 'Test',
            'notification_type' => 'informational',
        ])
        ->assertStatus(403);

    Carbon::setTestNow(); // reset
});

// ─── Rejection: outside time window (non-UTC timezone) ───────────────────────

test('leader notification is rejected when sent before the 4-hour window', function () {
    [, $workshop, $session, $leaderUser] = makeMessagingFixture();

    // Window starts at 06:00 CST = 12:00 UTC.
    // Set time to 11:59 UTC (5:59 CST) — 1 minute BEFORE the window.
    freezeAt('2026-01-15 11:59:00');

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Too early',
            'message' => 'Message',
            'notification_type' => 'informational',
        ])
        ->assertStatus(422)
        ->assertJsonStructure(['message']);

    Carbon::setTestNow();
});

test('leader notification is rejected when sent after the 2-hour post-session window', function () {
    [, $workshop, $session, $leaderUser] = makeMessagingFixture();

    // Window ends at 14:00 CST = 20:00 UTC.
    // Set time to 20:01 UTC (14:01 CST) — 1 minute AFTER the window.
    freezeAt('2026-01-15 20:01:00');

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Too late',
            'message' => 'Message',
            'notification_type' => 'informational',
        ])
        ->assertStatus(422)
        ->assertJsonStructure(['message']);

    Carbon::setTestNow();
});

// ─── Acceptance: valid message within window ───────────────────────────────────

test('leader notification within window is accepted and produces audit_log record', function () {
    [, $workshop, $session, $leaderUser, $leader, $participant] = makeMessagingFixture();

    // Inside window: 17:00 UTC = 11:00 CST
    freezeAt('2026-01-15 17:00:00');

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'See you soon',
            'message' => 'Just a reminder about today\'s session.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(201)
        ->assertJsonStructure(['notification_id', 'recipient_count']);

    $notificationId = $response->json('notification_id');

    // Notification record must exist
    $this->assertDatabaseHas('notifications', [
        'id' => $notificationId,
        'session_id' => $session->id,
        'sender_scope' => 'leader',
        'delivery_scope' => 'session_participants',
    ]);

    // Recipient must be the session participant
    $this->assertDatabaseHas('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id' => $participant->id,
    ]);

    // Audit log MUST exist — this is non-negotiable
    $this->assertDatabaseHas('audit_logs', [
        'entity_type' => 'notification',
        'entity_id' => $notificationId,
        'action' => 'leader_notification_sent',
        'actor_user_id' => $leaderUser->id,
    ]);

    $auditLog = AuditLog::where('entity_type', 'notification')
        ->where('entity_id', $notificationId)
        ->first();

    expect($auditLog->metadata_json['leader_id'])->toBe($leader->id);
    expect($auditLog->metadata_json['session_id'])->toBe($session->id);
    expect($auditLog->metadata_json['recipient_count'])->toBe(1);

    Carbon::setTestNow();
});

// ─── Time window boundary cases ───────────────────────────────────────────────

test('notification sent exactly at window start (06:00 CST) is accepted', function () {
    [, $workshop, $session, $leaderUser] = makeMessagingFixture();

    // Exactly at window start: 06:00 CST = 12:00 UTC
    freezeAt('2026-01-15 12:00:00');

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Boundary test',
            'message' => 'At window start.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(201);

    Carbon::setTestNow();
});

test('notification sent exactly at window end (14:00 CST) is accepted', function () {
    [, $workshop, $session, $leaderUser] = makeMessagingFixture();

    // Exactly at window end: 14:00 CST = 20:00 UTC
    freezeAt('2026-01-15 20:00:00');

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Boundary test',
            'message' => 'At window end.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(201);

    Carbon::setTestNow();
});

// ─── Recipients scoped to session only ───────────────────────────────────────

test('leader notification recipients are scoped to session participants only', function () {
    [$org, $workshop, $session, $leaderUser, , $sessionParticipant] = makeMessagingFixture();

    // Another participant registered to the workshop but NOT selected this session
    $otherParticipant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($otherParticipant->id)->create();
    // Intentionally NOT creating a session_selection for $otherParticipant

    freezeAt('2026-01-15 17:00:00');

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Session only',
            'message' => 'For session participants.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(201);

    $notificationId = $response->json('notification_id');

    // Only the session participant should be a recipient
    $this->assertDatabaseHas('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id' => $sessionParticipant->id,
    ]);

    // The workshop-only registrant must NOT be a recipient
    $this->assertDatabaseMissing('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id' => $otherParticipant->id,
    ]);

    Carbon::setTestNow();
});

// ─── Participant cannot use notification endpoint ─────────────────────────────

test('plain participant cannot create a notification', function () {
    [, $workshop, $session] = makeMessagingFixture();

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    freezeAt('2026-01-15 17:00:00');

    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'session_id' => $session->id,
            'title' => 'Not allowed',
            'message' => 'I am not a leader.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(403);

    Carbon::setTestNow();
});
