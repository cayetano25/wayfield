<?php

declare(strict_types=1);

use App\Models\Address;
use App\Models\GeocodeCache;
use App\Services\Geocoding\GeocodingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Shared helpers ────────────────────────────────────────────────────────────

/**
 * A successful Nominatim API response for Portland, OR.
 */
function nominatimSuccess(): array
{
    return [[
        'lat'          => '45.5231',
        'lon'          => '-122.6765',
        'display_name' => '123 Main Street, Portland, Oregon, United States',
        'importance'   => 0.85,
        'type'         => 'house',
        'place_id'     => '12345',
    ]];
}

/**
 * Fake Nominatim with a success response and prevent observer jobs from running.
 * Call this at the top of every GeocodingServiceTest.
 * Queue::fake() prevents the AddressObserver's dispatched job from running
 * synchronously (QUEUE_CONNECTION=sync in tests), keeping Http::assertSentCount accurate.
 */
function setupGeocodingTest(array $nominatimResponse = null): void
{
    Queue::fake();
    Http::fake([
        'https://nominatim.openstreetmap.org/*' => Http::response(
            $nominatimResponse ?? nominatimSuccess(),
            200
        ),
    ]);
}

// ─── Successful geocoding ─────────────────────────────────────────────────────

test('geocode returns true and stores coordinates on successful API call', function () {
    setupGeocodingTest();

    $address = Address::factory()->geocodeable()->create();
    $service = app(GeocodingService::class);

    $result = $service->geocode($address);

    expect($result)->toBeTrue();

    $fresh = $address->fresh();
    expect($fresh->latitude)->toBe(45.5231);
    expect($fresh->longitude)->toBe(-122.6765);
    expect($fresh->validation_status)->toBe('verified');
    expect($fresh->last_geocoded_at)->not->toBeNull();
    expect($fresh->geocode_error)->toBeNull();
});

test('geocode creates geocode_cache entry with correct data on success', function () {
    setupGeocodingTest();

    $address = Address::factory()->geocodeable()->create();
    $service = app(GeocodingService::class);
    $service->geocode($address);

    $address->refresh();
    $cache = GeocodeCache::where('geocode_hash', $address->geocode_hash)->first();

    expect($cache)->not->toBeNull();
    expect($cache->status)->toBe('hit');
    expect($cache->latitude)->toBe(45.5231);
    expect($cache->longitude)->toBe(-122.6765);
    expect($cache->confidence)->toBe(85); // round(0.85 * 100)
    expect($cache->provider)->toBe('nominatim');
    expect($cache->expires_at)->not->toBeNull();
});

// ─── Cache hit ────────────────────────────────────────────────────────────────

test('geocode uses cache on second call and does not call API again', function () {
    setupGeocodingTest();

    $address = Address::factory()->geocodeable()->create();
    $service = app(GeocodingService::class);

    $service->geocode($address); // first call — hits Nominatim API
    Http::assertSentCount(1);

    // Reload so the service sees fresh geocode_hash
    $address->refresh();

    $service->geocode($address); // second call — must read from cache
    Http::assertSentCount(1);    // still 1 — no second API call
});

test('geocode uses cache for a different address with identical content (cross-tenant)', function () {
    setupGeocodingTest();

    $service = app(GeocodingService::class);
    $fields  = [
        'address_line_1'      => '123 Main St',
        'locality'            => 'Portland',
        'administrative_area' => 'OR',
        'postal_code'         => '97201',
        'country_code'        => 'US',
    ];

    $address1 = Address::factory()->create($fields);
    $address2 = Address::factory()->create($fields); // same content, different row

    $service->geocode($address1); // populates cache
    Http::assertSentCount(1);

    $service->geocode($address2); // same hash → cache hit
    Http::assertSentCount(1);     // no second API call

    expect($address2->fresh()->latitude)->not->toBeNull();
    expect($address2->fresh()->latitude)->toBe(45.5231);
});

// ─── Miss (no results) ────────────────────────────────────────────────────────

test('geocode returns false and sets validation_status=failed on miss', function () {
    setupGeocodingTest([]); // empty array = no results

    $address = Address::factory()->geocodeable()->create();
    $service = app(GeocodingService::class);

    $result = $service->geocode($address);

    expect($result)->toBeFalse();

    $fresh = $address->fresh();
    expect($fresh->validation_status)->toBe('failed');
    expect($fresh->geocode_error)->not->toBeNull();
    expect($fresh->geocode_error)->toContain('not found');

    $cache = GeocodeCache::where('geocode_hash', $address->fresh()->geocode_hash)->first();
    expect($cache)->not->toBeNull();
    expect($cache->status)->toBe('miss');
});

// ─── API error ────────────────────────────────────────────────────────────────

test('geocode returns false on 500 error and creates short-lived failed cache entry', function () {
    Queue::fake();
    Http::fake([
        'https://nominatim.openstreetmap.org/*' => Http::response('', 500),
    ]);

    $address = Address::factory()->geocodeable()->create();
    $service = app(GeocodingService::class);

    $result = $service->geocode($address);

    expect($result)->toBeFalse();

    $fresh = $address->fresh();
    expect($fresh->validation_status)->toBe('failed');

    $cache = GeocodeCache::where('geocode_hash', $fresh->geocode_hash)->first();
    expect($cache)->not->toBeNull();
    expect($cache->status)->toBe('failed');

    // Transient errors get a short TTL (1 hour) — must expire well before 2 hours
    expect($cache->expires_at->isBefore(now()->addHours(2)))->toBeTrue();
});

// ─── Non-geocodeable address ──────────────────────────────────────────────────

test('geocode returns false and makes no API call for non-geocodeable address', function () {
    Queue::fake();
    Http::fake(['https://nominatim.openstreetmap.org/*' => Http::response(nominatimSuccess(), 200)]);

    // Only a country code — not enough for Nominatim
    $address               = new Address();
    $address->country_code = 'US';
    $address->save();

    $service = app(GeocodingService::class);
    $result  = $service->geocode($address);

    expect($result)->toBeFalse();
    Http::assertNothingSent();
});

// ─── Low confidence warning (does not block success) ─────────────────────────

test('geocode succeeds with low confidence result and still stores coordinates', function () {
    Queue::fake();
    Http::fake([
        'https://nominatim.openstreetmap.org/*' => Http::response([[
            'lat'          => '45.5231',
            'lon'          => '-122.6765',
            'display_name' => 'Portland, Oregon, United States',
            'importance'   => 0.20, // low confidence
            'type'         => 'city',
            'place_id'     => '99999',
        ]], 200),
    ]);

    $address = Address::factory()->geocodeable()->create();
    $service = app(GeocodingService::class);

    $result = $service->geocode($address);

    expect($result)->toBeTrue();
    expect($address->fresh()->latitude)->not->toBeNull();

    $cache = GeocodeCache::where('geocode_hash', $address->fresh()->geocode_hash)->first();
    expect($cache->confidence)->toBe(20); // round(0.20 * 100)
});
