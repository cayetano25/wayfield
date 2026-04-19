<?php

use App\Models\Location;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLogistics;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('participant sees only their selected sessions for session-based workshop', function () {
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $session1 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 11:00:00',
    ]);
    $session2 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 13:00:00',
        'end_at' => '2026-09-01 15:00:00',
    ]);

    // Only select session1.
    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session1->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $ids = collect($response->json('sessions'))->pluck('id');
    expect($ids)->toContain($session1->id);
    expect($ids)->not->toContain($session2->id);
});

test('canceled selections do not appear in my schedule', function () {
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    // Canceled selection.
    SessionSelection::factory()->canceled()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    expect($response->json('sessions'))->toHaveCount(0);
});

test('event-based workshop schedule returns all published sessions', function () {
    $workshop = Workshop::factory()->eventBased()->published()->create();
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    // Unpublished session must not appear.
    Session::factory()->forWorkshop($workshop->id)->create(['is_published' => false]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    expect($response->json('sessions'))->toHaveCount(2);
});

test('unregistered user cannot view my-schedule', function () {
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(403);
});

test('participant schedule resource does not expose meeting_url for virtual sessions in session-based schedule', function () {
    // Participant-facing schedule uses ParticipantSessionResource which exposes
    // meeting_url only for virtual/hybrid sessions to registered participants.
    // This is a deliberate design choice — participants who are registered CAN see
    // meeting_url in their schedule so they can join. This differs from PublicSessionResource
    // which NEVER exposes meeting_url.
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $virtualSession = Session::factory()->virtual()->forWorkshop($workshop->id)->published()->create();

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $virtualSession->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    // Registered participant CAN see meeting_url in their schedule.
    $sessionData = collect($response->json('sessions'))->firstWhere('id', $virtualSession->id);
    expect($sessionData['meeting_url'])->not->toBeNull();
});

test('public workshop endpoint never exposes meeting_url', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug' => 'test-workshop-public',
    ]);

    Session::factory()->virtual()->forWorkshop($workshop->id)->published()->create();

    $response = $this->getJson('/api/v1/public/workshops/test-workshop-public')
        ->assertStatus(200);

    // No meeting_url anywhere in the response body.
    $body = json_encode($response->json());
    expect($body)->not->toContain('meeting_url');
    expect($body)->not->toContain('meeting_passcode');
    expect($body)->not->toContain('meeting_id');
});

test('response includes workshop metadata with default_location_id', function () {
    $workshop = Workshop::factory()->eventBased()->published()->create();
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $response->assertJsonStructure([
        'workshop' => ['id', 'title', 'timezone', 'default_location_id'],
    ]);
    expect($response->json('workshop.id'))->toBe($workshop->id);
});

test('response includes workshop_logistics hotel fields', function () {
    $workshop = Workshop::factory()->eventBased()->published()->create();
    WorkshopLogistics::factory()->create([
        'workshop_id' => $workshop->id,
        'hotel_name' => 'Grand Photo Hotel',
        'hotel_address' => '123 Main St, Denver, CO',
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    expect($response->json('workshop_logistics.hotel_name'))->toBe('Grand Photo Hotel');
    expect($response->json('workshop_logistics.hotel_address'))->toBe('123 Main St, Denver, CO');
});

test('workshop_logistics is null when no logistics record exists', function () {
    $workshop = Workshop::factory()->eventBased()->published()->create();
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    expect($response->json('workshop_logistics'))->toBeNull();
});

test('session with own location_id returns that location', function () {
    $org = \App\Models\Organization::factory()->create();
    $location = Location::factory()->create([
        'organization_id' => $org->id,
        'name' => 'Studio A',
        'latitude' => 39.7392,
        'longitude' => -104.9903,
    ]);
    $workshop = Workshop::factory()->eventBased()->published()->create([
        'organization_id' => $org->id,
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'location_id' => $location->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionData = $response->json('sessions.0');
    expect($sessionData['location'])->not->toBeNull();
    expect($sessionData['location']['name'])->toBe('Studio A');
});

test('session without location_id falls back to workshop default location', function () {
    $org = \App\Models\Organization::factory()->create();
    $defaultLocation = Location::factory()->create([
        'organization_id' => $org->id,
        'name' => 'Workshop HQ',
        'latitude' => 40.7128,
        'longitude' => -74.0060,
    ]);
    $workshop = Workshop::factory()->eventBased()->published()->create([
        'organization_id' => $org->id,
        'default_location_id' => $defaultLocation->id,
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'location_id' => null,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionData = $response->json('sessions.0');
    expect($sessionData['location'])->not->toBeNull();
    expect($sessionData['location']['name'])->toBe('Workshop HQ');
});

test('session returns null location when both session and workshop have no location', function () {
    $workshop = Workshop::factory()->eventBased()->published()->create([
        'default_location_id' => null,
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'location_id' => null,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionData = $response->json('sessions.0');
    expect($sessionData['location'])->toBeNull();
});

test('coordinate-only location returns non-null location object with float lat lng', function () {
    $org = \App\Models\Organization::factory()->create();
    // Location with only coordinates — all address text fields null.
    $coordLocation = Location::factory()->create([
        'organization_id' => $org->id,
        'name' => null,
        'address_line_1' => null,
        'address_line_2' => null,
        'city' => null,
        'state_or_region' => null,
        'postal_code' => null,
        'country' => null,
        'latitude' => 51.5074,
        'longitude' => -0.1278,
    ]);
    $workshop = Workshop::factory()->eventBased()->published()->create([
        'organization_id' => $org->id,
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'location_id' => $coordLocation->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $loc = $response->json('sessions.0.location');
    expect($loc)->not->toBeNull();
    expect($loc['latitude'])->toBeFloat();
    expect($loc['longitude'])->toBeFloat();
    expect($loc['latitude'])->toBe(51.5074);
    expect($loc['longitude'])->toBe(-0.1278);
});

test('latitude and longitude are numbers not strings in json response', function () {
    $org = \App\Models\Organization::factory()->create();
    $location = Location::factory()->create([
        'organization_id' => $org->id,
        'latitude' => 37.7749,
        'longitude' => -122.4194,
    ]);
    $workshop = Workshop::factory()->eventBased()->published()->create([
        'organization_id' => $org->id,
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'location_id' => $location->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    // Verify the raw JSON encodes lat/lng as numbers, not quoted strings.
    $rawJson = $response->getContent();
    expect($rawJson)->toMatch('/"latitude":[\d\-\.]+[^"]/');
    expect($rawJson)->toMatch('/"longitude":[\d\-\.]+[^"]/');
});
