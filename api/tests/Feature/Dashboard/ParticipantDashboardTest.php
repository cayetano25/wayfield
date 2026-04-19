<?php

use App\Models\AttendanceRecord;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a published workshop with configurable dates and returns [$user, $workshop, $registration].
 */
function makeParticipantScenario(string $relativeStart, string $relativeEnd): array
{
    $user = User::factory()->create();

    $workshop = Workshop::factory()->create([
        'status' => 'published',
        'public_page_enabled' => true,
        'start_date' => Carbon::parse($relativeStart)->toDateString(),
        'end_date' => Carbon::parse($relativeEnd)->toDateString(),
    ]);

    $registration = Registration::factory()->create([
        'user_id' => $user->id,
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
        'registered_at' => now()->subDay(),
    ]);

    return [$user, $workshop, $registration];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('returns active workshop as the most imminent registered workshop', function () {
    [$user, $upcomingWorkshop, $upcomingReg] = makeParticipantScenario('+3 days', '+6 days');
    [$user2, $inProgressWorkshop, $inProgressReg] = makeParticipantScenario('-1 day', '+1 day');

    // Register same user in both workshops
    $inProgressReg->update(['user_id' => $user->id]);
    $upcomingReg->update(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    // In-progress workshop should be active_workshop
    expect($response->json('active_workshop.workshop_id'))->toBe($inProgressWorkshop->id);
});

test('returns null active_workshop when user has no registrations', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk()
        ->assertJsonPath('active_workshop', null)
        ->assertJsonPath('other_workshops', []);
});

test('next_session is the earliest upcoming selected session', function () {
    [$user, $workshop, $registration] = makeParticipantScenario('-1 day', '+3 days');

    $session1 = Session::factory()->create([
        'workshop_id' => $workshop->id,
        'start_at' => now()->addHours(6),
        'end_at' => now()->addHours(8),
        'is_published' => true,
    ]);
    $session2 = Session::factory()->create([
        'workshop_id' => $workshop->id,
        'start_at' => now()->addHours(24),
        'end_at' => now()->addHours(26),
        'is_published' => true,
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $registration->id,
        'session_id' => $session1->id,
        'selection_status' => 'selected',
    ]);
    SessionSelection::factory()->create([
        'registration_id' => $registration->id,
        'session_id' => $session2->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    // Earliest future session that is not checked-in should be next_session
    expect($response->json('active_workshop.next_session.session_id'))->toBe($session1->id);
});

test('next_session is null when all sessions are completed or none selected', function () {
    [$user, $workshop, $registration] = makeParticipantScenario('-3 days', '-1 day');

    // Past session with no selection
    Session::factory()->create([
        'workshop_id' => $workshop->id,
        'start_at' => now()->subDays(2),
        'end_at' => now()->subDays(2)->addHours(2),
        'is_published' => true,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    expect($response->json('active_workshop.next_session'))->toBeNull();
});

test('next_session is null when user is already checked in to all future sessions', function () {
    [$user, $workshop, $registration] = makeParticipantScenario('-1 day', '+3 days');

    $session = Session::factory()->create([
        'workshop_id' => $workshop->id,
        'start_at' => now()->addHours(4),
        'end_at' => now()->addHours(6),
        'is_published' => true,
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $registration->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    // User is already checked in
    AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $user->id,
        'status' => 'checked_in',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    expect($response->json('active_workshop.next_session'))->toBeNull();
});

test('other_workshops excludes the active_workshop', function () {
    [$user, $upcomingWorkshop, $upcomingReg] = makeParticipantScenario('+5 days', '+8 days');
    [$user2, $inProgressWorkshop, $inProgressReg] = makeParticipantScenario('-1 day', '+1 day');

    $upcomingReg->update(['user_id' => $user->id]);
    $inProgressReg->update(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    $activeId = $response->json('active_workshop.workshop_id');
    $otherWorkshops = $response->json('other_workshops');
    $otherIds = array_column($otherWorkshops, 'workshop_id');

    expect($activeId)->toBe($inProgressWorkshop->id);
    expect($otherIds)->not->toContain($inProgressWorkshop->id);
    expect($otherIds)->toContain($upcomingWorkshop->id);
});

test('completed workshops appear in other_workshops', function () {
    [$user, $activeWorkshop, $activeReg] = makeParticipantScenario('+1 day', '+3 days');
    [$user2, $pastWorkshop, $pastReg] = makeParticipantScenario('-10 days', '-7 days');

    $activeReg->update(['user_id' => $user->id]);
    $pastReg->update(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    $otherIds = array_column($response->json('other_workshops'), 'workshop_id');
    expect($otherIds)->toContain($pastWorkshop->id);

    $pastEntry = collect($response->json('other_workshops'))
        ->firstWhere('workshop_id', $pastWorkshop->id);
    expect($pastEntry['status'])->toBe('completed');
});

test('sessions in active_workshop include attendance_status', function () {
    [$user, $workshop, $registration] = makeParticipantScenario('-1 day', '+2 days');

    $session = Session::factory()->create([
        'workshop_id' => $workshop->id,
        'start_at' => now()->subHour(),
        'end_at' => now()->addHour(),
        'is_published' => true,
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $registration->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $user->id,
        'status' => 'checked_in',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/dashboard')
        ->assertOk();

    $sessions = $response->json('active_workshop.sessions');
    expect($sessions)->toHaveCount(1);
    expect($sessions[0]['attendance_status'])->toBe('checked_in');
});

test('unauthenticated request returns 401', function () {
    $this->getJson('/api/v1/me/dashboard')->assertUnauthorized();
});
