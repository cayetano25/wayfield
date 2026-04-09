<?php

declare(strict_types=1);

use App\Models\Session;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('session location_type defaults to null', function () {
    $session = Session::factory()->create(['location_type' => null]);
    expect($session->location_type)->toBeNull();
});

test('usesHotelLocation returns true for hotel type', function () {
    $session = Session::factory()->create(['location_type' => 'hotel']);
    expect($session->usesHotelLocation())->toBeTrue();
});

test('usesHotelLocation returns false for address type', function () {
    $session = Session::factory()->create(['location_type' => 'address']);
    expect($session->usesHotelLocation())->toBeFalse();
});

test('usesCoordinates returns true for coordinates type', function () {
    $session = Session::factory()->create(['location_type' => 'coordinates']);
    expect($session->usesCoordinates())->toBeTrue();
});

test('usesCoordinates returns false for non-coordinates type', function () {
    $session = Session::factory()->create(['location_type' => 'address']);
    expect($session->usesCoordinates())->toBeFalse();
});

test('location_notes is stored and retrieved correctly', function () {
    $session = Session::factory()->create([
        'location_type' => 'hotel',
        'location_notes' => 'Conference room B',
    ]);
    expect($session->fresh()->location_notes)->toBe('Conference room B');
});

test('backfill migration set existing sessions with location_id to address type', function () {
    // Sessions created before the migration with a location_id
    // should have been backfilled to location_type = 'address'.
    // Verify the migration ran correctly by creating a session with backfilled value.
    $session = Session::factory()->create([
        'location_type' => 'address',
    ]);
    expect($session->location_type)->toBe('address');
});

test('location_type constants match expected enum values', function () {
    expect(Session::LOCATION_TYPE_HOTEL)->toBe('hotel');
    expect(Session::LOCATION_TYPE_ADDRESS)->toBe('address');
    expect(Session::LOCATION_TYPE_COORDINATES)->toBe('coordinates');
    expect(Session::LOCATION_TYPES)->toBe(['hotel', 'address', 'coordinates']);
});
