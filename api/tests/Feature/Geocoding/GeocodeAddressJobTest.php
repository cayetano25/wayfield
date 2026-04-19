<?php

declare(strict_types=1);

use App\Jobs\GeocodeAddressJob;
use App\Models\Address;
use App\Services\Geocoding\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ══════════════════════════════════════════════════════════════
// Observer dispatch tests
// These verify the AddressObserver dispatches the job correctly.
// Queue::fake() captures dispatches without running them.
// ══════════════════════════════════════════════════════════════

test('job is dispatched when a geocodeable address is created', function () {
    Queue::fake();

    $address = Address::factory()->geocodeable()->create();

    Queue::assertPushed(GeocodeAddressJob::class);
});

test('job is dispatched on the geocoding queue', function () {
    Queue::fake();

    Address::factory()->geocodeable()->create();

    Queue::assertPushedOn('geocoding', GeocodeAddressJob::class);
});

test('job is NOT dispatched when a non-geocodeable address is created', function () {
    Queue::fake();

    // Only a country code — isGeocodeable() returns false
    Address::factory()->create([
        'address_line_1' => null,
        'locality' => null,
        'country_code' => 'US',
    ]);

    Queue::assertNotPushed(GeocodeAddressJob::class);
});

test('job is dispatched when a meaningful address field changes', function () {
    Queue::fake();

    $address = Address::factory()->withCoordinates()->create();

    // withCoordinates() already has coordinates → needsGeocoding() = false
    // Clear the queue count from creation dispatch (if any)
    Queue::assertNotPushed(GeocodeAddressJob::class); // withCoordinates() skips dispatch

    // Updating address_line_1 is a meaningful change
    $address->update(['address_line_1' => '999 Different St']);

    // Observer should reset state and dispatch a new job
    Queue::assertPushed(GeocodeAddressJob::class);
});

test('job is NOT dispatched when a non-meaningful field is updated', function () {
    Queue::fake();

    $address = Address::factory()->withCoordinates()->create();

    // geocode_error is not in AddressObserver::GEOCODING_FIELDS
    $address->update(['geocode_error' => 'some internal metadata update']);

    Queue::assertNotPushed(GeocodeAddressJob::class);
});

test('meaningful address update resets coordinates to null', function () {
    Queue::fake();

    $address = Address::factory()->withCoordinates()->create();

    expect($address->latitude)->not->toBeNull();
    expect($address->longitude)->not->toBeNull();

    $address->update(['address_line_1' => '999 Different St']);

    $fresh = $address->fresh();
    expect($fresh->latitude)->toBeNull();
    expect($fresh->longitude)->toBeNull();
    expect($fresh->validation_status)->toBe('unverified');
    expect($fresh->geocode_attempts)->toBe(0);
    expect($fresh->geocode_error)->toBeNull();
});

// ══════════════════════════════════════════════════════════════
// Job execution tests
// These call $job->handle() directly to test the job's logic
// without going through the queue.
// ══════════════════════════════════════════════════════════════

test('job skips and makes no API call when address already has coordinates', function () {
    Queue::fake(); // prevent observer from running job during creation

    $address = Address::factory()->withCoordinates()->create();
    // withCoordinates() has needsGeocoding() = false → no dispatch
    // but we want to test the job's own guard when called directly

    // Manually set coordinates without using the factory state (simulate race condition)
    $address->updateQuietly(['latitude' => 45.5231, 'longitude' => -122.6765]);

    Http::fake(['https://nominatim.openstreetmap.org/*' => Http::response([], 200)]);

    $job = new GeocodeAddressJob($address->id);
    $job->handle(app(GeocodingService::class));

    Http::assertNothingSent();
});

test('job skips and makes no API call when address is not geocodeable', function () {
    Queue::fake();

    $address = Address::factory()->create([
        'address_line_1' => null,
        'locality' => null,
        'country_code' => 'US',
    ]);

    Http::fake(['https://nominatim.openstreetmap.org/*' => Http::response([], 200)]);

    $job = new GeocodeAddressJob($address->id);
    $job->handle(app(GeocodingService::class));

    Http::assertNothingSent();
});

test('job makes no API call when max geocoding attempts are exceeded', function () {
    Queue::fake();

    // geocode_attempts = 3 means needsGeocoding() = false → observer won't dispatch
    // but we test the job's own max-attempts guard when called directly
    $address = Address::factory()->geocodeable()->create([
        'geocode_attempts' => 3,
    ]);

    Http::fake(['https://nominatim.openstreetmap.org/*' => Http::response([], 200)]);

    $job = new GeocodeAddressJob($address->id);
    $job->handle(app(GeocodingService::class));

    Http::assertNothingSent();
});

test('job silently returns when address no longer exists', function () {
    Queue::fake();

    // Dispatch for an ID that does not exist
    Http::fake(['https://nominatim.openstreetmap.org/*' => Http::response([], 200)]);

    $job = new GeocodeAddressJob(99999);
    $job->handle(app(GeocodingService::class));

    Http::assertNothingSent();
});

test('job calls GeocodingService and stores coordinates on success', function () {
    Queue::fake();

    Http::fake([
        'https://nominatim.openstreetmap.org/*' => Http::response([[
            'lat' => '45.5231',
            'lon' => '-122.6765',
            'display_name' => '123 Main Street, Portland, Oregon, United States',
            'importance' => 0.85,
            'type' => 'house',
            'place_id' => '12345',
        ]], 200),
    ]);

    $address = Address::factory()->geocodeable()->create();

    $job = new GeocodeAddressJob($address->id);
    $job->handle(app(GeocodingService::class));

    $fresh = $address->fresh();
    expect($fresh->latitude)->toBe(45.5231);
    expect($fresh->longitude)->toBe(-122.6765);
    expect($fresh->validation_status)->toBe('verified');
});

// ══════════════════════════════════════════════════════════════
// dispatchForAddress() guard tests
// ══════════════════════════════════════════════════════════════

test('dispatchForAddress does not dispatch when address already has coordinates', function () {
    Queue::fake();

    $address = Address::factory()->withCoordinates()->create();

    // withCoordinates() already passes through the observer (which returns early
    // because needsGeocoding() = false), so no jobs were pushed from the create.
    Queue::assertNotPushed(GeocodeAddressJob::class);

    // Calling dispatchForAddress directly should also be a no-op
    GeocodeAddressJob::dispatchForAddress($address);

    Queue::assertNotPushed(GeocodeAddressJob::class);
});

test('dispatchForAddress does not dispatch when max attempts exceeded', function () {
    Queue::fake();

    $address = Address::factory()->geocodeable()->create([
        'geocode_attempts' => 3,
    ]);

    Queue::assertNotPushed(GeocodeAddressJob::class);

    GeocodeAddressJob::dispatchForAddress($address);

    Queue::assertNotPushed(GeocodeAddressJob::class);
});
