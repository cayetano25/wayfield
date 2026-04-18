<?php

use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\Location;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLogistics;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSerializerFixture(string $workshopType = 'event_based'): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->create([
            'workshop_type' => $workshopType,
            'timezone' => 'America/New_York',
        ]);
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'delivery_type' => 'in_person',
            'start_at' => now()->addDay(),
            'end_at' => now()->addDay()->addHours(2),
        ]);

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);

    return [$org, $workshop, $session, $leaderUser, $leader];
}

// ─── Required fields ──────────────────────────────────────────────────────────

test('leader session list includes all required top-level fields', function () {
    [,, $session, $leaderUser] = makeSerializerFixture();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $item = $response->json('0');

    expect($item)->toHaveKeys([
        'id', 'title', 'description', 'start_at', 'end_at',
        'workshop', 'location', 'capacity', 'enrolled_count',
        'messaging_window_open', 'participants',
    ]);

    expect($item['workshop'])->toHaveKeys(['id', 'title', 'timezone', 'default_location']);
    expect($item)->toHaveKey('workshop_hotel');
});

test('workshop title is not truncated', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->create([
            'title' => 'A Very Long Workshop Title That Must Not Be Truncated In Any Way',
            'timezone' => 'UTC',
        ]);
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => now()->addDay(),
        'end_at' => now()->addDay()->addHours(2),
    ]);
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    expect($response->json('0.workshop.title'))
        ->toBe('A Very Long Workshop Title That Must Not Be Truncated In Any Way');
});

// ─── Location field ───────────────────────────────────────────────────────────

test('location is null when neither session nor workshop has a location', function () {
    [,, $session, $leaderUser] = makeSerializerFixture();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    expect($response->json('0.location'))->toBeNull();
});

test('coordinate-only location returns a non-null location object with lat and lng', function () {
    $org = Organization::factory()->create();
    $location = Location::factory()->create([
        'organization_id' => $org->id,
        'name' => null,
        'address_line_1' => null,
        'city' => null,
        'state_or_region' => null,
        'postal_code' => null,
        'latitude' => '48.858844',
        'longitude' => '2.294351',
    ]);
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'timezone' => 'UTC',
    ]);
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'location_id' => $location->id,
        'start_at' => now()->addDay(),
        'end_at' => now()->addDay()->addHours(2),
    ]);
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $loc = $response->json('0.location');
    expect($loc)->not->toBeNull();
    expect($loc['id'])->toBe($location->id);
    expect($loc['latitude'])->toBe(48.858844);
    expect($loc['longitude'])->toBe(2.294351);
    expect($loc['address_line_1'])->toBeNull();
    expect($loc['city'])->toBeNull();
});

test('session location falls back to workshop default location when session location_id is null', function () {
    $org = Organization::factory()->create();
    $defaultLocation = Location::factory()->create([
        'organization_id' => $org->id,
        'name' => 'Workshop Venue',
        'city' => 'Portland',
        'latitude' => '45.523064',
        'longitude' => '-122.676483',
    ]);
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'timezone' => 'UTC',
        'default_location_id' => $defaultLocation->id,
    ]);
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'location_id' => null,
        'start_at' => now()->addDay(),
        'end_at' => now()->addDay()->addHours(2),
    ]);
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $loc = $response->json('0.location');
    expect($loc)->not->toBeNull();
    expect($loc['id'])->toBe($defaultLocation->id);
    expect($loc['name'])->toBe('Workshop Venue');
    expect($loc['city'])->toBe('Portland');
});

test('workshop_hotel object is present in leader session response', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'timezone' => 'UTC',
    ]);
    WorkshopLogistics::factory()->create([
        'workshop_id' => $workshop->id,
        'hotel_name' => 'The Grand Hotel',
        'hotel_address' => '123 Main St, Portland, OR',
        'hotel_phone' => '+15031234567',
    ]);
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => now()->addDay(),
        'end_at' => now()->addDay()->addHours(2),
    ]);
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $hotel = $response->json('0.workshop_hotel');
    expect($hotel)->toHaveKeys(['hotel_name', 'hotel_address', 'hotel_phone']);
    expect($hotel['hotel_name'])->toBe('The Grand Hotel');
    expect($hotel['hotel_address'])->toBe('123 Main St, Portland, OR');
    expect($hotel['hotel_phone'])->toBe('+15031234567');
});

test('workshop_hotel fields are null when no logistics record exists', function () {
    [,, $session, $leaderUser] = makeSerializerFixture();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $hotel = $response->json('0.workshop_hotel');
    expect($hotel)->toHaveKeys(['hotel_name', 'hotel_address', 'hotel_phone']);
    expect($hotel['hotel_name'])->toBeNull();
    expect($hotel['hotel_address'])->toBeNull();
    expect($hotel['hotel_phone'])->toBeNull();
});

// ─── messaging_window_open ────────────────────────────────────────────────────

test('messaging_window_open is true when within the 4h-before to 2h-after window', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['timezone' => 'UTC']);
    // Window: start_at - 4h to end_at + 2h. Set start_at 1h from now → window opened 3h ago.
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => now()->addHour(),
        'end_at' => now()->addHours(3),
    ]);
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    expect($response->json('0.messaging_window_open'))->toBeTrue();
});

test('messaging_window_open is false when outside the window', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create(['timezone' => 'UTC']);
    // Window ends 2h after end_at. Set end_at 3h in the past → window closed 1h ago.
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => now()->subHours(5),
        'end_at' => now()->subHours(3),
    ]);
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create(['session_id' => $session->id, 'leader_id' => $leader->id]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    expect($response->json('0.messaging_window_open'))->toBeFalse();
});

// ─── Participants and phone_number visibility ──────────────────────────────────

test('assigned leader sees participant phone_number in participant list', function () {
    [$org, $workshop, $session, $leaderUser] = makeSerializerFixture('event_based');

    $participant = User::factory()->create(['phone_number' => '+15551234567']);
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $participants = $response->json('0.participants');
    $found = collect($participants)->firstWhere('user.id', $participant->id);

    expect($found)->not->toBeNull();
    expect($found['user']['phone_number'])->toBe('+15551234567');
});

test('participant list includes attendance status', function () {
    [$org, $workshop, $session, $leaderUser] = makeSerializerFixture('event_based');

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'checked_in',
        'check_in_method' => 'leader',
        'checked_in_at' => now(),
    ]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $participants = $response->json('0.participants');
    $found = collect($participants)->firstWhere('user.id', $participant->id);

    expect($found['attendance']['status'])->toBe('checked_in');
    expect($found['attendance']['check_in_method'])->toBe('leader');
    expect($found['attendance']['checked_in_at'])->not->toBeNull();
});

test('participant without attendance record shows not_checked_in', function () {
    [$org, $workshop, $session, $leaderUser] = makeSerializerFixture('event_based');

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    $participants = $response->json('0.participants');
    $found = collect($participants)->firstWhere('user.id', $participant->id);

    expect($found['attendance']['status'])->toBe('not_checked_in');
    expect($found['attendance']['check_in_method'])->toBeNull();
    expect($found['attendance']['checked_in_at'])->toBeNull();
});

// ─── enrolled_count ───────────────────────────────────────────────────────────

test('enrolled_count reflects registered participants for event_based workshop', function () {
    [$org, $workshop, $session, $leaderUser] = makeSerializerFixture('event_based');

    User::factory()->count(3)->create()->each(function ($user) use ($workshop) {
        Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    });

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    expect($response->json('0.enrolled_count'))->toBe(3);
});

test('enrolled_count reflects selected participants for session_based workshop', function () {
    [$org, $workshop, $session, $leaderUser] = makeSerializerFixture('session_based');

    User::factory()->count(2)->create()->each(function ($user) use ($workshop, $session) {
        $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
        SessionSelection::factory()->create([
            'registration_id' => $reg->id,
            'session_id' => $session->id,
            'selection_status' => 'selected',
        ]);
    });

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk();

    expect($response->json('0.enrolled_count'))->toBe(2);
});

// ─── Unauthenticated / no leader profile ──────────────────────────────────────

test('user with no leader profile gets empty session list', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertOk()
        ->assertExactJson([]);
});
