<?php

declare(strict_types=1);

use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Models\Organization;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wptMakeTier(array $overrides = []): WorkshopPriceTier
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    return WorkshopPriceTier::create(array_merge([
        'workshop_id'    => $workshop->id,
        'label'          => 'Test Tier',
        'price_cents'    => 25000,
        'valid_from'     => null,
        'valid_until'    => null,
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ], $overrides));
}

// ─── isDateEligible ───────────────────────────────────────────────────────────

test('wpt: isDateEligible returns true when no date bounds set', function () {
    $tier = wptMakeTier(['valid_from' => null, 'valid_until' => null]);

    expect($tier->isDateEligible(now()))->toBeTrue();
});

test('wpt: isDateEligible returns false when valid_from is in the future', function () {
    $tier = wptMakeTier(['valid_from' => now()->addDay(), 'valid_until' => null]);

    expect($tier->isDateEligible(now()))->toBeFalse();
});

test('wpt: isDateEligible returns false when valid_until is in the past', function () {
    $tier = wptMakeTier(['valid_from' => null, 'valid_until' => now()->subDay()]);

    expect($tier->isDateEligible(now()))->toBeFalse();
});

test('wpt: isDateEligible returns true when within valid date range', function () {
    $tier = wptMakeTier([
        'valid_from'  => now()->subDay(),
        'valid_until' => now()->addDay(),
    ]);

    expect($tier->isDateEligible(now()))->toBeTrue();
});

test('wpt: isDateEligible returns true on exact valid_from boundary', function () {
    $now = now();
    $tier = wptMakeTier(['valid_from' => $now->copy(), 'valid_until' => null]);

    expect($tier->isDateEligible($now))->toBeTrue();
});

// ─── isCapacityEligible ───────────────────────────────────────────────────────

test('wpt: isCapacityEligible returns true when capacity_limit is null', function () {
    $tier = wptMakeTier(['capacity_limit' => null]);

    expect($tier->isCapacityEligible(9999))->toBeTrue();
});

test('wpt: isCapacityEligible returns true when registrations are under limit', function () {
    $tier = wptMakeTier(['capacity_limit' => 10]);

    expect($tier->isCapacityEligible(9))->toBeTrue();
});

test('wpt: isCapacityEligible returns false when registrations equal limit', function () {
    $tier = wptMakeTier(['capacity_limit' => 10]);

    expect($tier->isCapacityEligible(10))->toBeFalse();
});

test('wpt: isCapacityEligible returns false when registrations exceed limit', function () {
    $tier = wptMakeTier(['capacity_limit' => 10]);

    expect($tier->isCapacityEligible(11))->toBeFalse();
});

// ─── isEligible ───────────────────────────────────────────────────────────────

test('wpt: isEligible returns true when both date and capacity conditions pass', function () {
    $tier = wptMakeTier([
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDay(),
        'capacity_limit' => 10,
    ]);

    expect($tier->isEligible(now(), 5))->toBeTrue();
});

test('wpt: isEligible returns false when capacity is full despite valid date', function () {
    $tier = wptMakeTier([
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDay(),
        'capacity_limit' => 5,
    ]);

    expect($tier->isEligible(now(), 5))->toBeFalse();
});

test('wpt: isEligible returns false when date is expired despite available capacity', function () {
    $tier = wptMakeTier([
        'valid_until'    => now()->subDay(),
        'capacity_limit' => 100,
    ]);

    expect($tier->isEligible(now(), 1))->toBeFalse();
});

// ─── getRemainingCapacity ─────────────────────────────────────────────────────

test('wpt: getRemainingCapacity returns null when no capacity_limit set', function () {
    $tier = wptMakeTier(['capacity_limit' => null]);

    expect($tier->getRemainingCapacity(50))->toBeNull();
});

test('wpt: getRemainingCapacity returns correct remaining count', function () {
    $tier = wptMakeTier(['capacity_limit' => 10]);

    expect($tier->getRemainingCapacity(3))->toBe(7);
});

test('wpt: getRemainingCapacity returns 0 when at or over capacity limit', function () {
    $tier = wptMakeTier(['capacity_limit' => 10]);

    expect($tier->getRemainingCapacity(10))->toBe(0);
    expect($tier->getRemainingCapacity(15))->toBe(0);
});
