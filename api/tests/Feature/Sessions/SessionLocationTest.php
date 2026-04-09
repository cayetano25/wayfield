<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLogistics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Hotel type ────────────────────────────────────────────

test('session can be set to hotel location type', function () {
    ['session' => $session, 'token' => $token] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type'  => 'hotel',
            'location_notes' => 'Conference room B',
        ])
        ->assertStatus(200)
        ->assertJsonPath('location.type', 'hotel')
        ->assertJsonPath('location.notes', 'Conference room B');

    expect($session->fresh()->location_id)->toBeNull();
    expect($session->fresh()->location_type)->toBe('hotel');
});

test('hotel session location returns hotel name from workshop logistics', function () {
    ['session' => $session, 'token' => $token, 'workshop' => $workshop] = makeSessionScenario();

    WorkshopLogistics::updateOrCreate(
        ['workshop_id' => $workshop->id],
        ['hotel_name' => 'The Grand Badlands Hotel']
    );

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'hotel',
        ])
        ->assertStatus(200)
        ->assertJsonPath('location.name', 'The Grand Badlands Hotel');
});

// ─── Coordinates type ──────────────────────────────────────

test('session can be set to coordinates location type', function () {
    Queue::fake();
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type'  => 'coordinates',
            'latitude'        => 43.574035673187794,
            'longitude'       => -103.48769165437184,
            'location_name'   => 'Black Hills Sunrise Ridge',
            'location_notes'  => 'At the rear of the parking lot',
        ])
        ->assertStatus(200)
        ->assertJsonPath('location.type', 'coordinates')
        ->assertJsonPath('location.latitude', '43.5740357')  // stored as decimal(10,7)
        ->assertJsonPath('location.longitude', '-103.4876917')
        ->assertJsonPath('location.name', 'Black Hills Sunrise Ridge')
        ->assertJsonPath('location.notes', 'At the rear of the parking lot');
});

test('coordinates location includes a Google Maps URL', function () {
    Queue::fake();
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $response = $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'coordinates',
            'latitude'      => 43.574035673187794,
            'longitude'     => -103.48769165437184,
        ])
        ->assertStatus(200);

    // Coordinates are stored as decimal(10,7) — 7 decimal places
    expect($response->json('location.maps_url'))
        ->toContain('43.5740357')
        ->toContain('-103.4876917');
});

test('GeocodeLocationJob is dispatched after saving a coordinates location', function () {
    Queue::fake();
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'coordinates',
            'latitude'      => 43.574035673187794,
            'longitude'     => -103.48769165437184,
        ]);

    Queue::assertPushed(\App\Jobs\GeocodeLocationJob::class);
});

test('coordinates type requires latitude and longitude', function () {
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'coordinates',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['latitude', 'longitude']);
});

// ─── Address type ──────────────────────────────────────────

test('session can be set to address location type', function () {
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type'  => 'address',
            'location_notes' => 'Behind the post office',
            'address'        => [
                'country_code'        => 'US',
                'address_line_1'      => '123 Main St',
                'locality'            => 'Hill City',
                'administrative_area' => 'SD',
                'postal_code'         => '57745',
            ],
        ])
        ->assertStatus(200)
        ->assertJsonPath('location.type', 'address')
        ->assertJsonPath('location.notes', 'Behind the post office')
        ->assertJsonPath('location.address.locality', 'Hill City');
});

test('address type requires address object', function () {
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'address',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['address']);
});

// ─── Clearing location ─────────────────────────────────────

test('setting location_type to null clears the location', function () {
    Queue::fake();
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    // First set a coordinates location
    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'coordinates',
            'latitude'      => 43.574035673187794,
            'longitude'     => -103.48769165437184,
        ]);

    // Now clear it
    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => null,
        ])
        ->assertStatus(200)
        ->assertJsonPath('location.type', null);

    expect($session->fresh()->location_id)->toBeNull();
    expect($session->fresh()->location_type)->toBeNull();
});

// ─── Switching between types ───────────────────────────────

test('session can switch from coordinates to hotel type', function () {
    Queue::fake();
    ['token' => $token, 'session' => $session] = makeSessionScenario();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'coordinates',
            'latitude'      => 43.574035673187794,
            'longitude'     => -103.48769165437184,
        ]);

    expect($session->fresh()->location_id)->not->toBeNull();

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type'  => 'hotel',
            'location_notes' => 'Conference room B',
        ])
        ->assertStatus(200)
        ->assertJsonPath('location.type', 'hotel');

    expect($session->fresh()->location_id)->toBeNull();
    expect($session->fresh()->location_type)->toBe('hotel');
});

// ─── Authorization ─────────────────────────────────────────

test('non-member cannot set session location', function () {
    ['session' => $session] = makeSessionScenario();
    $outsider = User::factory()->create();
    $token = $outsider->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'location_type' => 'hotel',
        ])
        ->assertStatus(403);
});

// ─── Helper ───────────────────────────────────────────────

function makeSessionScenario(): array
{
    $owner = User::factory()->create();
    $org = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'timezone'        => 'America/Chicago',
    ]);
    $session = Session::factory()->create([
        'workshop_id' => $workshop->id,
    ]);
    $token = $owner->createToken('web')->plainTextToken;

    return compact('owner', 'org', 'workshop', 'session', 'token');
}
