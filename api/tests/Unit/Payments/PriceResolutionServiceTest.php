<?php

declare(strict_types=1);

use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function prsSvc(): PriceResolutionService
{
    return app(PriceResolutionService::class);
}

function prsWorkshop(int $basePriceCents = 50000): Workshop
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status'          => 'published',
        'start_date'      => now()->addMonths(3)->toDateString(),
    ]);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => $basePriceCents,
        'currency'         => 'usd',
        'is_paid'          => $basePriceCents > 0,
    ]);

    return $workshop;
}

function prsTier(Workshop $workshop, array $overrides = []): WorkshopPriceTier
{
    return WorkshopPriceTier::create(array_merge([
        'workshop_id'    => $workshop->id,
        'label'          => 'Early Bird',
        'price_cents'    => 30000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ], $overrides));
}

// ─── Base price scenarios ─────────────────────────────────────────────────────

test('prs: returns base price when no tiers exist', function () {
    $workshop = prsWorkshop(50000);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(50000);
    expect($result->isTierPrice)->toBeFalse();
    expect($result->tierId)->toBeNull();
});

test('prs: returns 0 when workshop has no pricing record', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(0);
    expect($result->isTierPrice)->toBeFalse();
});

test('prs: returns 0 for free workshop even if a tier exists', function () {
    $workshop = prsWorkshop(0);
    prsTier($workshop);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(0);
    expect($result->isTierPrice)->toBeFalse();
});

test('prs: returns base price when only tier is expired', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, [
        'valid_from'  => now()->subDays(10),
        'valid_until' => now()->subDay(),
    ]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(50000);
    expect($result->isTierPrice)->toBeFalse();
});

test('prs: returns base price when tier is not yet active', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, [
        'valid_from'  => now()->addDays(10),
        'valid_until' => now()->addDays(20),
    ]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(50000);
    expect($result->isTierPrice)->toBeFalse();
});

// ─── Tier price scenarios ─────────────────────────────────────────────────────

test('prs: returns tier price for active date-bounded tier', function () {
    $workshop = prsWorkshop(50000);
    $tier = prsTier($workshop, ['price_cents' => 30000]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(30000);
    expect($result->isTierPrice)->toBeTrue();
    expect($result->tierId)->toBe($tier->id);
    expect($result->tierLabel)->toBe('Early Bird');
    expect($result->basePriceCents)->toBe(50000);
});

test('prs: capacity-based tier eligible when under limit', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['capacity_limit' => 20, 'valid_until' => null]);

    Cache::forget("registration_count_{$workshop->id}");
    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->isTierPrice)->toBeTrue();
    expect($result->remainingCapacity)->toBe(20);
});

test('prs: capacity-based tier ineligible when at limit', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['capacity_limit' => 5, 'valid_until' => null]);

    for ($i = 0; $i < 5; $i++) {
        $u = User::factory()->create();
        Registration::create([
            'user_id'             => $u->id,
            'workshop_id'         => $workshop->id,
            'registration_status' => 'registered',
            'registered_at'       => now(),
        ]);
    }

    Cache::forget("registration_count_{$workshop->id}");
    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->isTierPrice)->toBeFalse();
    expect($result->priceCents)->toBe(50000);
});

test('prs: lower sort_order wins when two tiers are simultaneously valid', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['sort_order' => 0, 'price_cents' => 20000, 'label' => 'Super Early']);
    prsTier($workshop, ['sort_order' => 1, 'price_cents' => 35000, 'label' => 'Early Bird']);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(20000);
    expect($result->tierLabel)->toBe('Super Early');
});

// ─── nextTier info ────────────────────────────────────────────────────────────

test('prs: nextTier populated when winning tier will expire', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['valid_until' => now()->addDays(3), 'capacity_limit' => null]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->nextTier)->not->toBeNull();
    expect($result->nextTier->priceCents)->toBe(50000);
    expect($result->nextTier->changeDirection)->toBe('increase');
});

test('prs: nextTier is null when winning tier has no expiry and no capacity limit', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['valid_until' => null, 'capacity_limit' => null]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->nextTier)->toBeNull();
});

test('prs: nextTier changeDirection is decrease when base is lower than tier price', function () {
    $workshop = prsWorkshop(20000);
    // Bypass API validation — set tier price above base directly in DB.
    prsTier($workshop, ['price_cents' => 30000, 'valid_until' => now()->addDays(3)]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    // After tier expires price drops to base (20000 < 30000).
    expect($result->nextTier)->not->toBeNull();
    expect($result->nextTier->changeDirection)->toBe('decrease');
});

// ─── remainingCapacity ────────────────────────────────────────────────────────

test('prs: remainingCapacity is null when tier has no capacity_limit', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['capacity_limit' => null]);

    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->remainingCapacity)->toBeNull();
});

test('prs: remainingCapacity reflects remaining seats', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['capacity_limit' => 10, 'valid_until' => null]);

    for ($i = 0; $i < 3; $i++) {
        $u = User::factory()->create();
        Registration::create([
            'user_id'             => $u->id,
            'workshop_id'         => $workshop->id,
            'registration_status' => 'registered',
            'registered_at'       => now(),
        ]);
    }

    Cache::forget("registration_count_{$workshop->id}");
    $result = prsSvc()->resolve($workshop, useCache: false);

    expect($result->remainingCapacity)->toBe(7);
});

// ─── Caching ──────────────────────────────────────────────────────────────────

test('prs: cached result is consistent across calls', function () {
    $workshop = prsWorkshop(50000);
    prsTier($workshop, ['price_cents' => 30000]);

    Cache::forget("price_resolution_{$workshop->id}");

    $first  = prsSvc()->resolve($workshop, useCache: true);
    $second = prsSvc()->resolve($workshop, useCache: true);

    expect($first->priceCents)->toBe($second->priceCents);
    expect($first->tierId)->toBe($second->tierId);
});

test('prs: bustCache causes recomputation after tier deactivation', function () {
    $workshop = prsWorkshop(50000);
    $tier = prsTier($workshop, ['price_cents' => 30000]);

    Cache::forget("price_resolution_{$workshop->id}");
    $before = prsSvc()->resolve($workshop, useCache: true);
    expect($before->priceCents)->toBe(30000);

    $tier->update(['is_active' => false]);
    prsSvc()->bustCache($workshop->id);

    $after = prsSvc()->resolve($workshop, useCache: true);
    expect($after->priceCents)->toBe(50000);
    expect($after->isTierPrice)->toBeFalse();
});
