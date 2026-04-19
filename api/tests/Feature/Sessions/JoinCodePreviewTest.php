<?php

use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Clear rate limiter state between tests so throttle does not bleed across cases.
    RateLimiter::clear('127.0.0.1');
});

// ─── Valid published code ────────────────────────────────────────────────────

test('valid published workshop code returns 200 with is_valid true and workshop data', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'PREVIEW1']);

    $this->getJson('/api/v1/join/PREVIEW1')
        ->assertStatus(200)
        ->assertJsonPath('join_code.is_valid', true)
        ->assertJsonPath('join_code.code', 'PREVIEW1')
        ->assertJsonStructure([
            'join_code' => ['code', 'is_valid'],
            'workshop' => [
                'id', 'title', 'workshop_type', 'start_date', 'end_date',
                'timezone', 'public_summary', 'description',
                'social_share_image_url', 'default_location',
            ],
            'user_state' => ['is_authenticated', 'is_already_registered'],
        ]);
});

test('workshop data contains expected field values', function () {
    $workshop = Workshop::factory()->published()->create([
        'join_code' => 'PREVIEW2',
        'title' => 'Landscape Photography Intensive',
        'workshop_type' => 'session_based',
        'timezone' => 'America/Chicago',
        'description' => 'Three days of field work.',
    ]);

    $response = $this->getJson('/api/v1/join/PREVIEW2')
        ->assertStatus(200);

    expect($response->json('workshop.id'))->toBe($workshop->id);
    expect($response->json('workshop.title'))->toBe('Landscape Photography Intensive');
    expect($response->json('workshop.workshop_type'))->toBe('session_based');
    expect($response->json('workshop.timezone'))->toBe('America/Chicago');
    expect($response->json('workshop.description'))->toBe('Three days of field work.');
});

// ─── Invalid / non-published codes ──────────────────────────────────────────

test('invalid join code returns 200 with is_valid false and no workshop object', function () {
    $response = $this->getJson('/api/v1/join/NOTREAL1')
        ->assertStatus(200)
        ->assertJsonPath('join_code.is_valid', false);

    expect($response->json('workshop'))->toBeNull();
});

test('draft workshop code returns 200 with is_valid false', function () {
    Workshop::factory()->draft()->create(['join_code' => 'DRAFT001']);

    $response = $this->getJson('/api/v1/join/DRAFT001')
        ->assertStatus(200)
        ->assertJsonPath('join_code.is_valid', false);

    expect($response->json('workshop'))->toBeNull();
});

test('archived workshop code returns 200 with is_valid false', function () {
    Workshop::factory()->archived()->create(['join_code' => 'ARCHV001']);

    $response = $this->getJson('/api/v1/join/ARCHV001')
        ->assertStatus(200)
        ->assertJsonPath('join_code.is_valid', false);

    expect($response->json('workshop'))->toBeNull();
});

// ─── User state ──────────────────────────────────────────────────────────────

test('authenticated user already registered shows is_already_registered true', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'REGCHECK']);
    $user = User::factory()->create();

    Registration::create([
        'workshop_id' => $workshop->id,
        'user_id' => $user->id,
        'registration_status' => 'registered',
        'registered_at' => now(),
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/join/REGCHECK')
        ->assertStatus(200)
        ->assertJsonPath('user_state.is_authenticated', true)
        ->assertJsonPath('user_state.is_already_registered', true);
});

test('authenticated user not yet registered shows is_already_registered false', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'NOTREG1']);
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/join/NOTREG1')
        ->assertStatus(200)
        ->assertJsonPath('user_state.is_authenticated', true)
        ->assertJsonPath('user_state.is_already_registered', false);
});

test('unauthenticated request returns is_authenticated false and is_already_registered false', function () {
    Workshop::factory()->published()->create(['join_code' => 'UNAUTH01']);

    $this->getJson('/api/v1/join/UNAUTH01')
        ->assertStatus(200)
        ->assertJsonPath('user_state.is_authenticated', false)
        ->assertJsonPath('user_state.is_already_registered', false);
});

test('canceled registration does not count as already registered', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'CANCELD1']);
    $user = User::factory()->create();

    Registration::create([
        'workshop_id' => $workshop->id,
        'user_id' => $user->id,
        'registration_status' => 'canceled',
        'registered_at' => now(),
        'canceled_at' => now(),
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/join/CANCELD1')
        ->assertStatus(200)
        ->assertJsonPath('user_state.is_already_registered', false);
});

// ─── Privacy enforcement ─────────────────────────────────────────────────────

test('response does not contain the raw join_code from the workshops table as a top-level field', function () {
    Workshop::factory()->published()->create(['join_code' => 'PRIVACY1']);

    $response = $this->getJson('/api/v1/join/PRIVACY1')->assertStatus(200);

    // The workshop object must not expose the internal join_code field.
    expect($response->json('workshop.join_code'))->toBeNull();
});

test('response does not contain meeting_url', function () {
    Workshop::factory()->published()->create(['join_code' => 'MEETURL1']);

    $response = $this->getJson('/api/v1/join/MEETURL1')->assertStatus(200);

    expect($response->json('workshop.meeting_url'))->toBeNull();
    expect($response->json('meeting_url'))->toBeNull();
});

test('response does not contain leader email or phone', function () {
    Workshop::factory()->published()->create(['join_code' => 'LEADER01']);

    $response = $this->getJson('/api/v1/join/LEADER01')->assertStatus(200);

    $body = $response->json();
    $encoded = json_encode($body);

    // No leader personal contact data in any part of the response.
    expect(isset($body['leaders']))->toBeFalse();
    expect(str_contains($encoded, '"email"'))->toBeFalse();
    expect(str_contains($encoded, '"phone"'))->toBeFalse();
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

test('21st request within 60 seconds returns 429', function () {
    Workshop::factory()->published()->create(['join_code' => 'RATELMT1']);

    for ($i = 0; $i < 20; $i++) {
        $this->getJson('/api/v1/join/RATELMT1')->assertStatus(200);
    }

    $this->getJson('/api/v1/join/RATELMT1')->assertStatus(429);
});
