<?php

use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\CartService;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ptrOrg(string $planCode = 'starter'): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    Subscription::factory()->forOrganization($org->id)->state(['plan_code' => $planCode, 'status' => 'active'])->create();

    return [$org, $user];
}

function ptrWorkshop(Organization $org, int $basePriceCents = 50000, bool $isPaid = true): Workshop
{
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status'          => 'published',
        'start_date'      => now()->addMonths(3)->toDateString(),
    ]);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => $basePriceCents,
        'currency'         => 'usd',
        'is_paid'          => $isPaid,
    ]);

    return $workshop;
}

function ptrCart(User $user, Organization $org): Cart
{
    return Cart::create([
        'user_id'          => $user->id,
        'organization_id'  => $org->id,
        'status'           => 'active',
        'subtotal_cents'   => 0,
        'currency'         => 'usd',
        'expires_at'       => now()->addHours(24),
        'last_activity_at' => now(),
    ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('regression: free workshop is unaffected by tier logic', function () {
    [$org, $user] = ptrOrg();
    $workshop = ptrWorkshop($org, 0, false);
    $cart     = ptrCart($user, $org);

    // Tier on a free workshop should be ignored by PriceResolutionService.
    WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Should Not Apply',
        'price_cents'    => 100,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

    Cache::forget("price_resolution_{$workshop->id}");
    $item = app(CartService::class)->addWorkshop($cart, $workshop);

    expect($item->unit_price_cents)->toBe(0);
    expect($item->is_tier_price)->toBeFalse();
});

test('regression: paid workshop without tiers uses base price in cart', function () {
    [$org, $user] = ptrOrg();
    $workshop = ptrWorkshop($org, 75000);
    $cart     = ptrCart($user, $org);

    Cache::forget("price_resolution_{$workshop->id}");
    $item = app(CartService::class)->addWorkshop($cart, $workshop);

    expect($item->unit_price_cents)->toBe(75000);
    expect($item->is_tier_price)->toBeFalse();
});

test('regression: price resolution returns consistent result over 10 calls', function () {
    [$org] = ptrOrg();
    $workshop = ptrWorkshop($org, 50000);

    WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Early Bird',
        'price_cents'    => 30000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

    Cache::forget("price_resolution_{$workshop->id}");
    $svc = app(PriceResolutionService::class);

    $prices = collect(range(1, 10))->map(fn () => $svc->resolve($workshop)->priceCents);

    expect($prices->unique())->toHaveCount(1);
    expect($prices->first())->toBe(30000);
});

test('regression: tier scheduling jobs created when tier is created via API', function () {
    [$org, $user] = ptrOrg('starter');
    $workshop = ptrWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Early Bird',
        'price_cents' => 30000,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertStatus(201);

    $tierId = WorkshopPriceTier::where('workshop_id', $workshop->id)->value('id');
    $jobs   = ScheduledPaymentJob::forEntity('workshop_price_tier', $tierId)->get();

    expect($jobs)->not->toBeEmpty();
});

test('regression: pending scheduling jobs cancelled when tier is deleted via API', function () {
    [$org, $user] = ptrOrg('starter');
    $workshop = ptrWorkshop($org);

    $tier = WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Early Bird',
        'price_cents'    => 30000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

    ScheduledPaymentJob::create([
        'job_type'            => 'price_tier_expiry_reminder',
        'related_entity_type' => 'workshop_price_tier',
        'related_entity_id'   => $tier->id,
        'scheduled_for'       => now()->addDays(6),
        'status'              => 'pending',
    ]);

    $this->actingAs($user)->deleteJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}")
        ->assertOk();

    $pendingCount = ScheduledPaymentJob::forEntity('workshop_price_tier', $tier->id)
        ->where('status', 'pending')
        ->count();

    expect($pendingCount)->toBe(0);
});

test('regression: bustCache clears resolution so updated tier price is reflected', function () {
    [$org] = ptrOrg();
    $workshop = ptrWorkshop($org, 50000);
    $svc  = app(PriceResolutionService::class);

    $tier = WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Early Bird',
        'price_cents'    => 30000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

    Cache::forget("price_resolution_{$workshop->id}");
    expect($svc->resolve($workshop)->priceCents)->toBe(30000);

    $tier->update(['is_active' => false]);
    $svc->bustCache($workshop->id);

    expect($svc->resolve($workshop)->priceCents)->toBe(50000);
});

test('regression: capacity boundary — exactly at limit is ineligible for tier price', function () {
    [$org] = ptrOrg();
    $workshop = ptrWorkshop($org, 50000);

    WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'First 5 Seats',
        'price_cents'    => 25000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => null,
        'capacity_limit' => 5,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

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
    $result = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($result->isTierPrice)->toBeFalse();
    expect($result->priceCents)->toBe(50000);
});

test('regression: capacity boundary — one under limit is eligible for tier price', function () {
    [$org] = ptrOrg();
    $workshop = ptrWorkshop($org, 50000);

    WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'First 5 Seats',
        'price_cents'    => 25000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => null,
        'capacity_limit' => 5,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

    for ($i = 0; $i < 4; $i++) {
        $u = User::factory()->create();
        Registration::create([
            'user_id'             => $u->id,
            'workshop_id'         => $workshop->id,
            'registration_status' => 'registered',
            'registered_at'       => now(),
        ]);
    }

    Cache::forget("registration_count_{$workshop->id}");
    $result = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($result->isTierPrice)->toBeTrue();
    expect($result->remainingCapacity)->toBe(1);
});

test('regression: multiple simultaneous valid tiers — lowest sort_order wins', function () {
    [$org] = ptrOrg();
    $workshop = ptrWorkshop($org, 50000);

    WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Priority',
        'price_cents'    => 20000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);

    WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Secondary',
        'price_cents'    => 35000,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => null,
        'sort_order'     => 1,
        'is_active'      => true,
    ]);

    Cache::forget("price_resolution_{$workshop->id}");
    $result = app(PriceResolutionService::class)->resolve($workshop, useCache: false);

    expect($result->priceCents)->toBe(20000);
    expect($result->tierLabel)->toBe('Priority');
});
