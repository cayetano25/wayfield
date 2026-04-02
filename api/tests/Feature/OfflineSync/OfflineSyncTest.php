<?php

use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\OfflineActionQueue;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeSyncWorkshop(): array
{
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => 'America/Chicago']);

    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'delivery_type' => 'in_person',
            'meeting_url'   => null,
        ]);

    return [$org, $workshop, $session];
}

function makeRegisteredParticipant(Workshop $workshop): User
{
    $user = User::factory()->create();
    Registration::factory()
        ->forWorkshop($workshop->id)
        ->forUser($user->id)
        ->create(['registration_status' => 'registered']);

    return $user;
}

function makeAcceptedLeader(Workshop $workshop, Session $session): array
{
    $leaderUser = User::factory()->create(['phone_number' => '555-0001']);
    $leader     = Leader::factory()->create(['user_id' => $leaderUser->id]);

    WorkshopLeader::create([
        'workshop_id'  => $workshop->id,
        'leader_id'    => $leader->id,
        'is_confirmed' => true,
    ]);

    SessionLeader::factory()->create([
        'session_id'        => $session->id,
        'leader_id'         => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    return [$leaderUser, $leader];
}

// ─── Sync Version ─────────────────────────────────────────────────────────────

test('sync version returns a sha256 hash', function () {
    [, $workshop] = makeSyncWorkshop();
    $user = makeRegisteredParticipant($workshop);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-version");

    $response->assertOk()
             ->assertJsonStructure(['version_hash']);

    expect(strlen($response->json('version_hash')))->toBe(64); // SHA-256 hex
});

test('sync version changes when a leader is added to a session', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    $user = makeRegisteredParticipant($workshop);

    $v1 = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-version")
        ->json('version_hash');

    // Add a leader assignment — touches session_leaders.updated_at
    $leader = Leader::factory()->create();
    SessionLeader::factory()->create([
        'session_id'        => $session->id,
        'leader_id'         => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    // Force updated_at to advance (MySQL TIMESTAMP has 1-second granularity in tests)
    $session->touch();

    $v2 = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-version")
        ->json('version_hash');

    expect($v1)->not->toBe($v2);
});

// ─── Sync Package — access control ───────────────────────────────────────────

test('unauthenticated user cannot download sync package', function () {
    [, $workshop] = makeSyncWorkshop();

    $this->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
         ->assertUnauthorized();
});

test('user with no relationship to workshop cannot download sync package', function () {
    [, $workshop] = makeSyncWorkshop();
    $stranger = User::factory()->create();

    $this->actingAs($stranger, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->assertForbidden();
});

test('registered participant can download sync package', function () {
    [, $workshop] = makeSyncWorkshop();
    $user = makeRegisteredParticipant($workshop);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->assertOk()
        ->assertJsonPath('data.role', 'participant');
});

test('assigned leader can download sync package', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    [$leaderUser] = makeAcceptedLeader($workshop, $session);

    $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->assertOk()
        ->assertJsonPath('data.role', 'leader');
});

// ─── Sync Package — privacy: meeting fields NEVER included ────────────────────

test('participant sync package never includes meeting_url', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    $session->update([
        'delivery_type' => 'virtual',
        'meeting_url'   => 'https://zoom.us/j/secret',
        'meeting_id'    => '123456',
        'meeting_passcode' => 'abc',
    ]);

    $user = makeRegisteredParticipant($workshop);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package");

    $body = $response->json();
    $encoded = json_encode($body);

    expect($encoded)->not->toContain('https://zoom.us/j/secret')
                    ->not->toContain('meeting_url')
                    ->not->toContain('meeting_id')
                    ->not->toContain('meeting_passcode');
});

test('leader sync package never includes meeting_url', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    $session->update([
        'delivery_type' => 'virtual',
        'meeting_url'   => 'https://zoom.us/j/leader-secret',
        'meeting_id'    => '999',
        'meeting_passcode' => 'xyz',
    ]);

    [$leaderUser] = makeAcceptedLeader($workshop, $session);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package");

    $encoded = json_encode($response->json());

    expect($encoded)->not->toContain('https://zoom.us/j/leader-secret')
                    ->not->toContain('meeting_passcode');
});

// ─── Sync Package — participant package has no phone numbers ──────────────────

test('participant sync package does not include roster or phone numbers', function () {
    [, $workshop] = makeSyncWorkshop();

    $participant = makeRegisteredParticipant($workshop);
    $participant->update(['phone_number' => '555-PRIVATE']);

    $requester = makeRegisteredParticipant($workshop);

    $response = $this->actingAs($requester, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package");

    $encoded = json_encode($response->json());

    expect($encoded)->not->toContain('555-PRIVATE');

    // Participant package must not contain a roster key
    expect($response->json('data.roster'))->toBeNull();
});

// ─── Sync Package — leaders array ─────────────────────────────────────────────

test('sync package leaders array includes all confirmed workshop leaders with public-safe fields', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    [$leaderUserA, $leaderA] = makeAcceptedLeader($workshop, $session);
    $leaderA->update(['email' => 'private@leader.com', 'phone_number' => '555-PRIV']);

    $participant = makeRegisteredParticipant($workshop);

    $data = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->json('data');

    $leaders = $data['leaders'];
    expect($leaders)->toHaveCount(1);
    expect($leaders[0])->toHaveKeys(['id', 'first_name', 'last_name', 'city', 'state_or_region']);

    // Private fields must not appear for other users
    $encoded = json_encode($leaders);
    expect($encoded)->not->toContain('private@leader.com')
                    ->not->toContain('555-PRIV');
});

test('leader sync package includes own private contact fields in leaders array', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    [$leaderUser, $leader] = makeAcceptedLeader($workshop, $session);
    $leader->update([
        'email'        => 'me@leader.com',
        'phone_number' => '555-OWN',
        'address_line_1' => '123 Private St',
    ]);

    $data = $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->json('data');

    $leaders  = collect($data['leaders']);
    $ownEntry = $leaders->firstWhere('id', $leader->id);

    expect($ownEntry['email'])->toBe('me@leader.com')
        ->and($ownEntry['phone_number'])->toBe('555-OWN');
});

// ─── Sync Package — per-leader roster scoping (critical) ─────────────────────

/**
 * Two leaders assigned to DIFFERENT sessions in the same workshop.
 * Each leader's sync package must contain ONLY their own session's roster data.
 */
test('two leaders receive only their own sessions roster in sync package', function () {
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create();

    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);

    // Leader A → Session A only
    $leaderUserA = User::factory()->create();
    $leaderA     = Leader::factory()->create(['user_id' => $leaderUserA->id]);
    WorkshopLeader::create(['workshop_id' => $workshop->id, 'leader_id' => $leaderA->id, 'is_confirmed' => true]);
    SessionLeader::factory()->create(['session_id' => $sessionA->id, 'leader_id' => $leaderA->id, 'assignment_status' => 'accepted']);

    // Leader B → Session B only
    $leaderUserB = User::factory()->create();
    $leaderB     = Leader::factory()->create(['user_id' => $leaderUserB->id]);
    WorkshopLeader::create(['workshop_id' => $workshop->id, 'leader_id' => $leaderB->id, 'is_confirmed' => true]);
    SessionLeader::factory()->create(['session_id' => $sessionB->id, 'leader_id' => $leaderB->id, 'assignment_status' => 'accepted']);

    // Participant A → Session A
    $participantA = User::factory()->create(['phone_number' => '555-ALPHA']);
    $regA = Registration::factory()->forWorkshop($workshop->id)->forUser($participantA->id)->create();
    SessionSelection::factory()->create(['registration_id' => $regA->id, 'session_id' => $sessionA->id, 'selection_status' => 'selected']);

    // Participant B → Session B
    $participantB = User::factory()->create(['phone_number' => '555-BRAVO']);
    $regB = Registration::factory()->forWorkshop($workshop->id)->forUser($participantB->id)->create();
    SessionSelection::factory()->create(['registration_id' => $regB->id, 'session_id' => $sessionB->id, 'selection_status' => 'selected']);

    // ── Leader A's sync package ──
    $dataA = $this->actingAs($leaderUserA, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->json('data');

    $rosterA = $dataA['roster'];
    expect($rosterA)->toHaveKey((string) $sessionA->id);
    expect($rosterA)->not->toHaveKey((string) $sessionB->id);

    // Leader A sees participant A's phone
    $encodedA = json_encode($rosterA);
    expect($encodedA)->toContain('555-ALPHA');
    // Leader A must NOT see participant B's phone (Session B)
    expect($encodedA)->not->toContain('555-BRAVO');

    // ── Leader B's sync package ──
    $dataB = $this->actingAs($leaderUserB, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->json('data');

    $rosterB = $dataB['roster'];
    expect($rosterB)->toHaveKey((string) $sessionB->id);
    expect($rosterB)->not->toHaveKey((string) $sessionA->id);

    $encodedB = json_encode($rosterB);
    expect($encodedB)->toContain('555-BRAVO');
    expect($encodedB)->not->toContain('555-ALPHA');
});

// ─── Offline Action Replay — idempotency ─────────────────────────────────────

test('replaying same client_action_uuid twice produces only one attendance row', function () {
    [, $workshop, $session] = makeSyncWorkshop();

    $participant = makeRegisteredParticipant($workshop);
    SessionSelection::factory()->create([
        'registration_id'  => Registration::where('user_id', $participant->id)->where('workshop_id', $workshop->id)->first()->id,
        'session_id'       => $session->id,
        'selection_status' => 'selected',
    ]);

    $uuid = \Illuminate\Support\Str::uuid()->toString();

    $payload = [
        'actions' => [
            [
                'client_action_uuid' => $uuid,
                'action_type'        => 'self_check_in',
                'payload'            => ['session_id' => $session->id],
            ],
        ],
    ];

    // First submission
    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/offline-actions", $payload)
        ->assertOk();

    // Second submission — same UUID
    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/offline-actions", $payload)
        ->assertOk();

    // Exactly ONE attendance row must exist
    $count = AttendanceRecord::where('session_id', $session->id)
        ->where('user_id', $participant->id)
        ->count();

    expect($count)->toBe(1);

    // offline_action_queue has only one row with this UUID
    $queueCount = OfflineActionQueue::where('client_action_uuid', $uuid)->count();
    expect($queueCount)->toBe(1);
});

test('replayed action that was already processed returns already_processed status', function () {
    [, $workshop, $session] = makeSyncWorkshop();

    $participant = makeRegisteredParticipant($workshop);
    SessionSelection::factory()->create([
        'registration_id'  => Registration::where('user_id', $participant->id)->where('workshop_id', $workshop->id)->first()->id,
        'session_id'       => $session->id,
        'selection_status' => 'selected',
    ]);

    $uuid = \Illuminate\Support\Str::uuid()->toString();

    $payload = [
        'actions' => [
            [
                'client_action_uuid' => $uuid,
                'action_type'        => 'self_check_in',
                'payload'            => ['session_id' => $session->id],
            ],
        ],
    ];

    // First submission — applied
    $first = $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/offline-actions", $payload)
        ->json('results');

    expect($first[$uuid]['status'])->toBe('applied');

    // Second submission — already processed
    $second = $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/offline-actions", $payload)
        ->json('results');

    expect($second[$uuid]['status'])->toBe('already_processed');
});

test('offline action with invalid session_id returns rejected status', function () {
    [, $workshop] = makeSyncWorkshop();
    $participant = makeRegisteredParticipant($workshop);

    $uuid = \Illuminate\Support\Str::uuid()->toString();

    $response = $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/offline-actions", [
            'actions' => [
                [
                    'client_action_uuid' => $uuid,
                    'action_type'        => 'self_check_in',
                    'payload'            => ['session_id' => 99999],
                ],
            ],
        ]);

    $response->assertOk();
    expect($response->json("results.{$uuid}.status"))->toBe('rejected');
});

test('unregistered participant offline self-check-in is rejected', function () {
    [, $workshop, $session] = makeSyncWorkshop();

    // This user is NOT registered in the workshop
    $stranger = User::factory()->create();

    $uuid = \Illuminate\Support\Str::uuid()->toString();

    $response = $this->actingAs($stranger, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/offline-actions", [
            'actions' => [
                [
                    'client_action_uuid' => $uuid,
                    'action_type'        => 'self_check_in',
                    'payload'            => ['session_id' => $session->id],
                ],
            ],
        ]);

    $response->assertForbidden(); // policy gate rejects before replay even runs
});

// ─── Sync Package — leader roster with event_based workshop ───────────────────

test('leader sees all registered participants in roster for event_based workshop without requiring selection', function () {
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->eventBased()
        ->create();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);

    [$leaderUser] = makeAcceptedLeader($workshop, $session);

    // Participants registered but NO session selection (event_based doesn't require it)
    $p1 = User::factory()->create(['phone_number' => '555-P1']);
    $p2 = User::factory()->create(['phone_number' => '555-P2']);
    Registration::factory()->forWorkshop($workshop->id)->forUser($p1->id)->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($p2->id)->create();

    $data = $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->json('data');

    $roster = $data['roster'][(string) $session->id] ?? [];

    $phones = array_column(array_column($roster, 'user'), 'phone_number');

    expect($phones)->toContain('555-P1')
                   ->toContain('555-P2');
});

// ─── Sync Package — my_selections in participant package ─────────────────────

test('participant sync package includes their selected sessions', function () {
    [, $workshop, $session] = makeSyncWorkshop();
    $participant = makeRegisteredParticipant($workshop);

    $reg = Registration::where('user_id', $participant->id)->where('workshop_id', $workshop->id)->first();
    SessionSelection::factory()->create([
        'registration_id'  => $reg->id,
        'session_id'       => $session->id,
        'selection_status' => 'selected',
    ]);

    $data = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sync-package")
        ->json('data');

    expect($data['my_selections'])->toContain($session->id);
});
