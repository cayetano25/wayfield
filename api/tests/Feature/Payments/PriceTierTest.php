<?php

use App\Domain\Payments\DTOs\PriceResolution;
use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tierOrg(string $planCode = 'creator', string $role = 'owner'): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => $role,
        'is_active'       => true,
    ]);

    Subscription::factory()->forOrganization($org->id)->state(['plan_code' => $planCode, 'status' => 'active'])->create();

    return [$org, $user];
}

function tierWorkshop(Organization $org): Workshop
{
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status'          => 'published',
        'start_date'      => now()->addMonths(3)->toDateString(),
    ]);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 50000,
        'currency'         => 'usd',
        'is_paid'          => true,
    ]);

    return $workshop;
}

function makeTier(Workshop $workshop, array $overrides = []): WorkshopPriceTier
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
        'registrations_at_tier' => 0,
    ], $overrides));
}

// ─── PriceResolutionService ───────────────────────────────────────────────────

test('returns base price when no tiers exist', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution)->toBeInstanceOf(PriceResolution::class);
    expect($resolution->priceCents)->toBe(50000);
    expect($resolution->isTierPrice)->toBeFalse();
    expect($resolution->tierId)->toBeNull();
});

test('returns zero price when workshop has no pricing', function () {
    [$org] = tierOrg();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->priceCents)->toBe(0);
    expect($resolution->isTierPrice)->toBeFalse();
});

test('returns zero price when base_price_cents is 0 (free workshop)', function () {
    [$org] = tierOrg();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 0,
        'currency'         => 'usd',
        'is_paid'          => false,
    ]);

    makeTier($workshop);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->priceCents)->toBe(0);
    expect($resolution->isTierPrice)->toBeFalse();
});

test('returns tier price when a valid tier exists', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);
    $tier     = makeTier($workshop, ['price_cents' => 30000]);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->priceCents)->toBe(30000);
    expect($resolution->isTierPrice)->toBeTrue();
    expect($resolution->tierId)->toBe($tier->id);
    expect($resolution->tierLabel)->toBe('Early Bird');
    expect($resolution->basePriceCents)->toBe(50000);
});

test('returns base price when all tiers are expired', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);

    makeTier($workshop, [
        'valid_from'  => now()->subDays(10),
        'valid_until' => now()->subDay(),
    ]);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->priceCents)->toBe(50000);
    expect($resolution->isTierPrice)->toBeFalse();
});

test('lower sort_order wins when two tiers are simultaneously valid', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);

    makeTier($workshop, ['sort_order' => 0, 'price_cents' => 25000, 'label' => 'Super Early']);
    makeTier($workshop, ['sort_order' => 1, 'price_cents' => 35000, 'label' => 'Early Bird']);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->priceCents)->toBe(25000);
    expect($resolution->tierLabel)->toBe('Super Early');
});

test('tier with capacity_limit=20 and registrations=20 is not eligible', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);

    makeTier($workshop, ['capacity_limit' => 20, 'valid_until' => null]);

    // Create 20 registrations.
    for ($i = 0; $i < 20; $i++) {
        $u = User::factory()->create();
        Registration::create([
            'user_id'             => $u->id,
            'workshop_id'         => $workshop->id,
            'registration_status' => 'registered',
            'registered_at'       => now(),
        ]);
    }

    Cache::forget("registration_count_{$workshop->id}");

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->priceCents)->toBe(50000);
    expect($resolution->isTierPrice)->toBeFalse();
});

test('tier with capacity_limit=20 and registrations=19 is still eligible', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);

    makeTier($workshop, ['capacity_limit' => 20, 'valid_until' => null]);

    for ($i = 0; $i < 19; $i++) {
        $u = User::factory()->create();
        Registration::create([
            'user_id'             => $u->id,
            'workshop_id'         => $workshop->id,
            'registration_status' => 'registered',
            'registered_at'       => now(),
        ]);
    }

    Cache::forget("registration_count_{$workshop->id}");

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->isTierPrice)->toBeTrue();
    expect($resolution->remainingCapacity)->toBe(1);
});

test('nextTier is populated when winning tier will expire', function () {
    [$org] = tierOrg();
    $workshop = tierWorkshop($org);

    makeTier($workshop, ['valid_until' => now()->addDays(3), 'capacity_limit' => null]);

    $resolution = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($resolution->nextTier)->not->toBeNull();
    expect($resolution->nextTier->priceCents)->toBe(50000);
    expect($resolution->nextTier->changeDirection)->toBe('increase');
});

// ─── Organizer Tier Endpoints ─────────────────────────────────────────────────

test('foundation plan org gets 402 on tier index', function () {
    [$org, $user] = tierOrg('foundation');
    $workshop = tierWorkshop($org);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers")
        ->assertStatus(402);
});

test('starter plan org can list tiers', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    makeTier($workshop);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers")
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'label', 'price_cents', 'is_currently_active']]]);
});

test('POST creates a tier and returns 201', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'          => 'Early Bird',
        'price_cents'    => 30000,
        'valid_until'    => now()->addDays(7)->toIso8601String(),
        'capacity_limit' => null,
    ])->assertStatus(201)
      ->assertJsonPath('data.label', 'Early Bird')
      ->assertJsonPath('data.price_cents', 30000);

    expect(WorkshopPriceTier::where('workshop_id', $workshop->id)->count())->toBe(1);
});

test('POST fails validation when no valid_until and no capacity_limit', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Lifetime',
        'price_cents' => 30000,
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['valid_until']);
});

test('POST fails when price_cents exceeds base_price_cents', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Premium',
        'price_cents' => 99999,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['price_cents']);
});

test('POST fails when valid_until is after workshop start_date', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Late',
        'price_cents' => 40000,
        'valid_until' => now()->addYear()->toIso8601String(),
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['valid_until']);
});

test('PATCH updates tier successfully', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    $tier     = makeTier($workshop);

    $this->actingAs($user)->patchJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}", [
        'label' => 'Super Early',
    ])->assertOk()
      ->assertJsonPath('data.label', 'Super Early');
});

test('PATCH cannot change price_cents once tier has been used', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    $tier     = makeTier($workshop);

    // Simulate registrations having used this tier.
    \Illuminate\Support\Facades\DB::table('workshop_price_tiers')
        ->where('id', $tier->id)
        ->update(['registrations_at_tier' => 5]);

    $this->actingAs($user)->patchJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}", [
        'price_cents' => 20000,
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['price_cents']);
});

test('DELETE soft-deactivates tier', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    $tier     = makeTier($workshop);

    $this->actingAs($user)->deleteJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}")
        ->assertOk()
        ->assertJsonFragment(['message' => 'Tier deactivated.']);

    expect($tier->fresh()->is_active)->toBeFalse();
});

test('PUT order reorders tiers', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);

    $tier1 = makeTier($workshop, ['sort_order' => 0, 'label' => 'First']);
    $tier2 = makeTier($workshop, ['sort_order' => 1, 'label' => 'Second']);

    $this->actingAs($user)->putJson("/api/v1/workshops/{$workshop->id}/price-tiers/order", [
        'tiers' => [
            ['id' => $tier1->id, 'sort_order' => 1],
            ['id' => $tier2->id, 'sort_order' => 0],
        ],
    ])->assertOk();

    expect($tier1->fresh()->sort_order)->toBe(1);
    expect($tier2->fresh()->sort_order)->toBe(0);
});

test('staff cannot create tiers', function () {
    [$org, $user] = tierOrg('creator', 'staff');
    $workshop = tierWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Early Bird',
        'price_cents' => 30000,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertForbidden();
});

// ─── CartService tier integration ─────────────────────────────────────────────

test('cart item stores applied_tier_id and is_tier_price when adding workshop with active tier', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    $tier     = makeTier($workshop, ['price_cents' => 30000]);

    Cache::forget("price_resolution_{$workshop->id}");

    $cart = Cart::create([
        'user_id'         => $user->id,
        'organization_id' => $org->id,
        'status'          => 'active',
        'subtotal_cents'  => 0,
        'currency'        => 'usd',
        'expires_at'      => now()->addHours(24),
        'last_activity_at' => now(),
    ]);

    $service = app(\App\Domain\Payments\Services\CartService::class);
    $item    = $service->addWorkshop($cart, $workshop);

    expect($item->applied_tier_id)->toBe($tier->id);
    expect($item->applied_tier_label)->toBe('Early Bird');
    expect($item->is_tier_price)->toBeTrue();
    expect($item->unit_price_cents)->toBe(30000);
});

test('cart item uses base price when no active tier', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);

    Cache::forget("price_resolution_{$workshop->id}");

    $cart = Cart::create([
        'user_id'         => $user->id,
        'organization_id' => $org->id,
        'status'          => 'active',
        'subtotal_cents'  => 0,
        'currency'        => 'usd',
        'expires_at'      => now()->addHours(24),
        'last_activity_at' => now(),
    ]);

    $service = app(\App\Domain\Payments\Services\CartService::class);
    $item    = $service->addWorkshop($cart, $workshop);

    expect($item->applied_tier_id)->toBeNull();
    expect($item->is_tier_price)->toBeFalse();
    expect($item->unit_price_cents)->toBe(50000);
});

// ─── Public current endpoint ─────────────────────────────────────────────────

test('GET price-tiers/current returns public display without auth', function () {
    [$org] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    makeTier($workshop, ['price_cents' => 30000]);

    $this->getJson("/api/v1/workshops/{$workshop->id}/price-tiers/current")
        ->assertOk()
        ->assertJsonStructure(['pricing' => ['current_price_cents', 'base_price_cents', 'is_tier_price']]);
});

test('GET price-tiers/current returns organizer view when authenticated as admin', function () {
    [$org, $user] = tierOrg('creator');
    $workshop = tierWorkshop($org);
    makeTier($workshop, ['price_cents' => 30000]);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers/current")
        ->assertOk()
        ->assertJsonStructure([
            'pricing_display',
            'current_resolution',
            'registration_count',
            'tiers',
        ]);
});
