<?php

declare(strict_types=1);

use App\Support\AddressFormatter;

// ─── formatCityRegion ─────────────────────────────────────────────────────────

test('US leader uses city-state abbreviation format', function () {
    expect(AddressFormatter::formatCityRegion('Portland', 'OR', 'US'))
        ->toBe('Portland, OR');
});

test('Canadian leader uses city-province abbreviation format', function () {
    expect(AddressFormatter::formatCityRegion('Vancouver', 'BC', 'CA'))
        ->toBe('Vancouver, BC');
});

test('Icelandic leader includes country name', function () {
    expect(AddressFormatter::formatCityRegion('Reykjavik', null, 'IS'))
        ->toBe('Reykjavik, Iceland');
});

test('Antarctic location includes country name', function () {
    expect(AddressFormatter::formatCityRegion('McMurdo Station', null, 'AQ'))
        ->toBe('McMurdo Station, Antarctica');
});

test('Arctic location includes custom region name', function () {
    expect(AddressFormatter::formatCityRegion('Svalbard', null, 'XA'))
        ->toBe('Svalbard, Arctic Region');
});

test('Greenland leader includes country name', function () {
    expect(AddressFormatter::formatCityRegion('Nuuk', null, 'GL'))
        ->toBe('Nuuk, Greenland');
});

test('non-abbreviation country with region includes all three parts', function () {
    expect(AddressFormatter::formatCityRegion('Tokyo', 'Kanto', 'JP'))
        ->toContain('Tokyo')
        ->toContain('Kanto');
});

test('no city returns null', function () {
    expect(AddressFormatter::formatCityRegion(null, 'OR', 'US'))->toBeNull();
    expect(AddressFormatter::formatCityRegion('', 'OR', 'US'))->toBeNull();
});

test('no country code still returns city', function () {
    expect(AddressFormatter::formatCityRegion('Oslo', null, null))
        ->toBe('Oslo');
});

test('US city without state returns just city', function () {
    expect(AddressFormatter::formatCityRegion('Chicago', null, 'US'))
        ->toBe('Chicago');
});

// ─── countryName ──────────────────────────────────────────────────────────────

test('countryName returns Antarctica for AQ', function () {
    expect(AddressFormatter::countryName('AQ'))->toBe('Antarctica');
});

test('countryName returns Arctic Region for XA', function () {
    expect(AddressFormatter::countryName('XA'))->toBe('Arctic Region');
});

test('countryName returns Iceland for IS', function () {
    expect(AddressFormatter::countryName('IS'))->toBe('Iceland');
});

test('countryName returns Greenland for GL', function () {
    expect(AddressFormatter::countryName('GL'))->toBe('Greenland');
});

test('countryName returns null for null input', function () {
    expect(AddressFormatter::countryName(null))->toBeNull();
});

test('countryName is case-insensitive', function () {
    expect(AddressFormatter::countryName('aq'))->toBe('Antarctica');
});
