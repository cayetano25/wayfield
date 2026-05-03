<?php

use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Fixture builder ──────────────────────────────────────────────────────────

/**
 * Build a complete leader notification fixture.
 *
 * Returns [$session, $leaderUser, $participant] where:
 * - $session is a session with start_at within the messaging window
 * - $leaderUser has a Leader profile assigned (accepted) to $session
 * - $participant has a Registration + SessionSelection (selected) for $session
 *
 * The workshop has a Starter plan subscription so messaging is allowed.
 */
function makeLeaderFixture(array $sessionOverrides = []): array
{
    $org = Organization::factory()->create();

    // Starter plan required for leader messaging
    Subscription::factory()->forOrganization($org->id)->creator()->active()->create();

    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => 'UTC']);

    // Session whose window is NOW: start_at = 2 hours from now, end_at = 4 hours from now
    // Window opens 4h before start (now-2h) and closes 2h after end (now+6h) — currently open.
    $defaultSessionTimes = [
        'start_at' => now()->addHours(2)->toDateTimeString(),
        'end_at' => now()->addHours(4)->toDateTimeString(),
    ];

    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create(array_merge($defaultSessionTimes, $sessionOverrides));

    // Leader user
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->withUser($leaderUser->id)->create();

    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    // Participant with registration + session selection
    $participant = User::factory()->create();
    $registration = Registration::factory()
        ->forWorkshop($workshop->id)
        ->forUser($participant->id)
        ->create();

    SessionSelection::factory()->create([
        'registration_id' => $registration->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    return [$session, $leaderUser, $participant];
}

// ─── Success path ─────────────────────────────────────────────────────────────

test('assigned leader within window can create notification — 201 with audit log and recipients', function () {
    Queue::fake();

    [$session, $leaderUser, $participant] = makeLeaderFixture();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'See you soon',
            'message' => 'Reminder about our session starting in 2 hours.',
            'notification_type' => 'reminder',
        ])
        ->assertStatus(201)
        ->assertJsonStructure(['notification_id', 'recipient_count']);

    $notificationId = $response->json('notification_id');

    // Notification record with server-set fields
    $this->assertDatabaseHas('notifications', [
        'id' => $notificationId,
        'session_id' => $session->id,
        'sender_scope' => 'leader',
        'delivery_scope' => 'session_participants',
        'notification_type' => 'reminder',
        'title' => 'See you soon',
    ]);

    // Recipient row created for the enrolled participant
    $this->assertDatabaseHas('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id' => $participant->id,
        'email_status' => 'pending',
        'push_status' => 'pending',
        'in_app_status' => 'pending',
    ]);

    // Mandatory audit log
    $this->assertDatabaseHas('audit_logs', [
        'entity_type' => 'notification',
        'entity_id' => $notificationId,
        'action' => 'leader_notification_sent',
        'actor_user_id' => $leaderUser->id,
    ]);
});

// ─── sender_scope cannot be overridden from request body ─────────────────────

test('request body cannot override sender_scope — it is always set to leader', function () {
    Queue::fake();

    [$session, $leaderUser] = makeLeaderFixture();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Override attempt',
            'message' => 'Trying to override sender_scope.',
            'notification_type' => 'informational',
            'sender_scope' => 'organizer', // must be ignored
            'delivery_scope' => 'all_participants', // must be ignored
            'session_id' => 999, // must be ignored
        ])
        ->assertStatus(201);

    $notificationId = $response->json('notification_id');

    $this->assertDatabaseHas('notifications', [
        'id' => $notificationId,
        'sender_scope' => 'leader',
        'delivery_scope' => 'session_participants',
        'session_id' => $session->id,
    ]);
});

// ─── Window: too early ────────────────────────────────────────────────────────

test('leader too early — outside window before session returns 422 with window times', function () {
    [$session, $leaderUser] = makeLeaderFixture([
        // Session starts 8 hours from now; window opens in 4 hours (not yet)
        'start_at' => now()->addHours(8)->toDateTimeString(),
        'end_at' => now()->addHours(10)->toDateTimeString(),
    ]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Too early',
            'message' => 'Not in window yet.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(422)
        ->assertJsonStructure(['error', 'message', 'window_start', 'window_end', 'messaging_window_open']);

    expect($response->json('error'))->toBe('messaging_window');
    expect($response->json('messaging_window_open'))->toBeFalse();
    expect($response->json('window_start'))->not->toBeNull();
    expect($response->json('window_end'))->not->toBeNull();
});

// ─── Window: too late ─────────────────────────────────────────────────────────

test('leader too late — outside window after session returns 422 with window times', function () {
    [$session, $leaderUser] = makeLeaderFixture([
        // Session ended 4 hours ago; window closed 2 hours ago
        'start_at' => now()->subHours(6)->toDateTimeString(),
        'end_at' => now()->subHours(4)->toDateTimeString(),
    ]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Too late',
            'message' => 'Window already closed.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(422)
        ->assertJsonStructure(['error', 'message', 'window_start', 'window_end', 'messaging_window_open']);

    expect($response->json('error'))->toBe('messaging_window');
    expect($response->json('messaging_window_open'))->toBeFalse();
});

// ─── Not assigned ─────────────────────────────────────────────────────────────

test('leader with profile but not assigned to this session returns 422', function () {
    [$session] = makeLeaderFixture();

    // A different leader — has a profile but no assignment for $session
    $otherLeaderUser = User::factory()->create();
    Leader::factory()->withUser($otherLeaderUser->id)->create();

    $this->actingAs($otherLeaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Not my session',
            'message' => 'I should not be able to do this.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'messaging_denied');
});

// ─── Unrelated user (not a leader) ───────────────────────────────────────────

test('user with no leader profile returns 403', function () {
    [$session] = makeLeaderFixture();

    $randomUser = User::factory()->create();

    $this->actingAs($randomUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Unauthorized',
            'message' => 'I am not a leader.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(403);
});

// ─── No participants enrolled ─────────────────────────────────────────────────

test('assigned leader in window with no participants enrolled returns 422', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->creator()->active()->create();

    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => 'UTC']);

    // Session in window
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'start_at' => now()->addHours(2)->toDateTimeString(),
            'end_at' => now()->addHours(4)->toDateTimeString(),
        ]);

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->withUser($leaderUser->id)->create();
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    // No participants — no registrations, no session selections

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Nobody home',
            'message' => 'Zero participants enrolled.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'no_participants');
});

// ─── delivery is queued not synchronous ──────────────────────────────────────

test('notification delivery is queued not sent synchronously', function () {
    Queue::fake();

    [$session, $leaderUser] = makeLeaderFixture();

    $this->actingAs($leaderUser, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/notifications", [
            'title' => 'Queue test',
            'message' => 'Should be queued.',
            'notification_type' => 'informational',
        ])
        ->assertStatus(201);

    Queue::assertPushed(\App\Jobs\SendEmailNotificationJob::class);
    Queue::assertPushed(\App\Jobs\SendPushNotificationJob::class);
});
