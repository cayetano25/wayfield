<?php

use App\Models\Leader;
use App\Models\LeaderInvitation;
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

/**
 * Creates a user + linked leader record. Returns [$user, $leader].
 */
function makeLeaderUser(): array
{
    $user = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $user->id]);

    return [$user, $leader];
}

/**
 * Creates a published workshop with a UTC timezone and an assigned session for the leader.
 * Returns [$workshop, $session].
 */
function makeLeaderSession(Leader $leader, array $sessionOverrides = []): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status' => 'published',
        'timezone' => 'UTC',
        'start_date' => now()->subDay()->toDateString(),
        'end_date' => now()->addDays(5)->toDateString(),
    ]);

    $session = Session::factory()->create(array_merge([
        'workshop_id' => $workshop->id,
        'start_at' => now()->setTime(10, 0, 0),
        'end_at' => now()->setTime(12, 0, 0),
        'is_published' => true,
    ], $sessionOverrides));

    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    return [$workshop, $session];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('returns pending invitations for the leader', function () {
    [$user, $leader] = makeLeaderUser();

    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create([
        'status' => 'published',
        'start_date' => now()->addDays(10)->toDateString(),
        'end_date' => now()->addDays(13)->toDateString(),
    ]);

    LeaderInvitation::factory()->create([
        'leader_id' => $leader->id,
        'organization_id' => $org->id,
        'workshop_id' => $workshop->id,
        'status' => 'pending',
        'expires_at' => now()->addDays(7),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    expect($response->json('pending_invitations'))->toHaveCount(1);
    expect($response->json('pending_invitations.0.organization_name'))->toBe($org->name);
});

test('today sessions are scoped to sessions starting today in workshop timezone', function () {
    [$user, $leader] = makeLeaderUser();

    // Session starting today in UTC
    [, $todaySession] = makeLeaderSession($leader, [
        'start_at' => now()->setTime(14, 0, 0),
        'end_at' => now()->setTime(16, 0, 0),
    ]);

    // Session starting tomorrow in UTC
    [, $tomorrowSession] = makeLeaderSession($leader, [
        'start_at' => now()->addDay()->setTime(10, 0, 0),
        'end_at' => now()->addDay()->setTime(12, 0, 0),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $todaySessionIds = array_column($response->json('today.sessions'), 'session_id');
    expect($todaySessionIds)->toContain($todaySession->id);
    expect($todaySessionIds)->not->toContain($tomorrowSession->id);
});

test('this_week excludes today and sessions beyond 7 days', function () {
    [$user, $leader] = makeLeaderUser();

    // Today session — should NOT appear in this_week
    [, $todaySession] = makeLeaderSession($leader, [
        'start_at' => now()->setTime(10, 0, 0),
        'end_at' => now()->setTime(12, 0, 0),
    ]);

    // 3 days from now — should appear in this_week
    [, $weekSession] = makeLeaderSession($leader, [
        'start_at' => now()->addDays(3)->setTime(10, 0, 0),
        'end_at' => now()->addDays(3)->setTime(12, 0, 0),
    ]);

    // 10 days from now — should appear in upcoming, NOT this_week
    [, $farSession] = makeLeaderSession($leader, [
        'start_at' => now()->addDays(10)->setTime(10, 0, 0),
        'end_at' => now()->addDays(10)->setTime(12, 0, 0),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $weekIds = array_column($response->json('this_week'), 'session_id');
    expect($weekIds)->toContain($weekSession->id);
    expect($weekIds)->not->toContain($todaySession->id);
    expect($weekIds)->not->toContain($farSession->id);
});

test('is_live is true when now is between start_at and end_at', function () {
    [$user, $leader] = makeLeaderUser();

    // Span the full current UTC day so start_at is always today regardless of the
    // time the test runs (avoids the midnight-hour failure where subHour() puts
    // start_at on yesterday's date and the dashboard categorises it as past).
    [, $liveSession] = makeLeaderSession($leader, [
        'start_at' => now()->startOfDay(),
        'end_at' => now()->endOfDay(),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $todaySessions = $response->json('today.sessions');
    $live = collect($todaySessions)->firstWhere('session_id', $liveSession->id);

    expect($live['is_live'])->toBeTrue();
});

test('is_live is false for future sessions', function () {
    [$user, $leader] = makeLeaderUser();

    [, $futureSession] = makeLeaderSession($leader, [
        'start_at' => now()->addHours(3),
        'end_at' => now()->addHours(5),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $todaySessions = $response->json('today.sessions');
    $entry = collect($todaySessions)->firstWhere('session_id', $futureSession->id);

    expect($entry['is_live'])->toBeFalse();
});

test('messaging_window is_open is true within the leader messaging window', function () {
    [$user, $leader] = makeLeaderUser();

    // Session starts in 2 hours (within the 4-hour pre-window)
    [, $session] = makeLeaderSession($leader, [
        'start_at' => now()->addHours(2),
        'end_at' => now()->addHours(4),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $todaySessions = $response->json('today.sessions');
    $entry = collect($todaySessions)->firstWhere('session_id', $session->id);

    // now() is 2 hours before start_at, and window opens 4 hours before start_at → within window
    expect($entry['messaging_window']['is_open'])->toBeTrue();
});

test('messaging_window is_open is false before the messaging window opens', function () {
    [$user, $leader] = makeLeaderUser();

    // Session starts in 6 hours (outside the 4-hour pre-window)
    [, $session] = makeLeaderSession($leader, [
        'start_at' => now()->addHours(6),
        'end_at' => now()->addHours(8),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $todaySessions = $response->json('today.sessions');
    $entry = collect($todaySessions)->firstWhere('session_id', $session->id);

    expect($entry['messaging_window']['is_open'])->toBeFalse();
});

test('user without a leader record returns 403', function () {
    $user = User::factory()->create(); // no leader record

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertForbidden()
        ->assertJsonPath('error', 'no_leader_record');
});

test('enrolled_count reflects selected session_selections count', function () {
    [$user, $leader] = makeLeaderUser();

    [$workshop, $session] = makeLeaderSession($leader, [
        'start_at' => now()->addHours(2),
        'end_at' => now()->addHours(4),
    ]);

    // Add 3 enrolled participants via session_selections
    $org = $workshop->organization;

    for ($i = 0; $i < 3; $i++) {
        $participant = User::factory()->create();
        $registration = Registration::factory()->create([
            'workshop_id' => $workshop->id,
            'user_id' => $participant->id,
            'registration_status' => 'registered',
        ]);
        SessionSelection::factory()->create([
            'session_id' => $session->id,
            'registration_id' => $registration->id,
            'selection_status' => 'selected',
        ]);
    }

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/dashboard')
        ->assertOk();

    $todaySessions = $response->json('today.sessions');
    $entry = collect($todaySessions)->firstWhere('session_id', $session->id);

    expect($entry['enrolled_count'])->toBe(3);
});
