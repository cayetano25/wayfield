<?php

declare(strict_types=1);

use App\Models\Address;
use App\Services\Geocoding\AddressNormalizer;
use Tests\TestCase;

uses(TestCase::class);

// ─── normalize() ──────────────────────────────────────────────────────────────

test('normalize produces uppercase trimmed pipe-separated string', function () {
    $normalizer = new AddressNormalizer();

    $address                       = new Address();
    $address->address_line_1       = '123 Main St';
    $address->locality             = 'Portland';
    $address->administrative_area  = 'OR';
    $address->postal_code          = '97201';
    $address->country_code         = 'US';

    expect($normalizer->normalize($address))->toBe('123 MAIN ST|PORTLAND|OR|97201|US');
});

test('normalize collapses multiple spaces', function () {
    $normalizer = new AddressNormalizer();

    $address               = new Address();
    $address->address_line_1 = '123  Main   St';
    $address->locality       = 'Portland';
    $address->country_code   = 'US';

    $normalized = $normalizer->normalize($address);

    expect($normalized)->toContain('123 MAIN ST');
    // Must not contain double spaces
    expect($normalized)->not->toContain('  ');
});

test('normalize strips postal code spaces for UK format', function () {
    $normalizer = new AddressNormalizer();

    $address              = new Address();
    $address->postal_code = 'SW1A 2AA';
    $address->country_code = 'GB';

    $normalized = $normalizer->normalize($address);

    expect($normalized)->toContain('SW1A2AA');
    expect($normalized)->not->toContain('SW1A 2AA');
});

test('normalize omits null fields', function () {
    $normalizer = new AddressNormalizer();

    $address               = new Address();
    $address->address_line_1 = '123 Main St';
    $address->address_line_2 = null;
    $address->locality       = 'Portland';
    $address->country_code   = 'US';

    $normalized = $normalizer->normalize($address);

    // Split by pipe and confirm there are no empty segments
    $parts = explode('|', $normalized);
    foreach ($parts as $part) {
        expect($part)->not->toBe('');
    }
    // Exactly 3 non-empty fields: address_line_1, locality, country_code
    expect(count($parts))->toBe(3);
});

// ─── hash() ───────────────────────────────────────────────────────────────────

test('hash returns 64-character hex string', function () {
    $normalizer = new AddressNormalizer();

    $address               = new Address();
    $address->address_line_1 = '123 Main St';
    $address->locality       = 'Portland';
    $address->country_code   = 'US';

    expect(strlen($normalizer->hash($address)))->toBe(64);
});

test('same address content produces same hash', function () {
    $normalizer = new AddressNormalizer();

    $a1               = new Address();
    $a1->address_line_1 = '123 Main St';
    $a1->locality       = 'Portland';
    $a1->administrative_area = 'OR';
    $a1->postal_code   = '97201';
    $a1->country_code  = 'US';

    $a2               = new Address();
    $a2->address_line_1 = '123 Main St';
    $a2->locality       = 'Portland';
    $a2->administrative_area = 'OR';
    $a2->postal_code   = '97201';
    $a2->country_code  = 'US';

    expect($normalizer->hash($a1))->toBe($normalizer->hash($a2));
});

test('different address content produces different hash', function () {
    $normalizer = new AddressNormalizer();

    $a1               = new Address();
    $a1->address_line_1 = '123 Main St';
    $a1->locality       = 'Portland';
    $a1->country_code   = 'US';

    $a2               = new Address();
    $a2->address_line_1 = '456 Elm Ave';
    $a2->locality       = 'Portland';
    $a2->country_code   = 'US';

    expect($normalizer->hash($a1))->not->toBe($normalizer->hash($a2));
});

// ─── toNominatimQuery() ───────────────────────────────────────────────────────

test('toNominatimQuery uses structured params when street and city exist', function () {
    $normalizer = new AddressNormalizer();

    $address               = new Address();
    $address->address_line_1 = '123 Main St';
    $address->locality       = 'Portland';
    $address->administrative_area = 'OR';
    $address->postal_code    = '97201';
    $address->country_code   = 'US';

    $params = $normalizer->toNominatimQuery($address);

    expect($params)->toHaveKey('street');
    expect($params)->toHaveKey('city');
    expect($params)->not->toHaveKey('q');
});

test('toNominatimQuery falls back to free-text when no street or city', function () {
    $normalizer = new AddressNormalizer();

    $address               = new Address();
    $address->address_line_1 = null;
    $address->locality       = null;
    $address->country_code   = 'US';

    $params = $normalizer->toNominatimQuery($address);

    expect($params)->toHaveKey('q');
    expect($params)->not->toHaveKey('street');
    expect($params)->not->toHaveKey('city');
});

test('toNominatimQuery always includes format=json and limit=1', function () {
    $normalizer = new AddressNormalizer();

    // Structured path
    $address               = new Address();
    $address->address_line_1 = '123 Main St';
    $address->locality       = 'Portland';
    $address->country_code   = 'US';

    $structured = $normalizer->toNominatimQuery($address);
    expect($structured['format'])->toBe('json');
    expect($structured['limit'])->toBe(1);

    // Free-text fallback path
    $sparse              = new Address();
    $sparse->country_code = 'US';

    $freeText = $normalizer->toNominatimQuery($sparse);
    expect($freeText['format'])->toBe('json');
    expect($freeText['limit'])->toBe(1);
});
