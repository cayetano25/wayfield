<?php

use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\CartService;
use App\Domain\Payments\Services\PriceResolutionService;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ptcOrg(): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    Subscription::factory()->forOrganization($org->id)->state(['plan_code' => 'starter', 'status' => 'active'])->create();

    return [$org, $user];
}

function ptcWorkshop(Organization $org, int $basePriceCents = 50000): Workshop
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
        'is_paid'          => true,
    ]);

    return $workshop;
}

function ptcMakeCart(User $user, Organization $org): Cart
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

function ptcActiveTier(Workshop $workshop, int $priceCents = 30000, ?int $capacityLimit = null): WorkshopPriceTier
{
    return WorkshopPriceTier::create([
        'workshop_id'    => $workshop->id,
        'label'          => 'Early Bird',
        'price_cents'    => $priceCents,
        'valid_from'     => now()->subDay(),
        'valid_until'    => now()->addDays(7),
        'capacity_limit' => $capacityLimit,
        'sort_order'     => 0,
        'is_active'      => true,
    ]);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('cart:tier cart item stores tier fields when adding workshop with active tier', function () {
    [$org, $user] = ptcOrg();
    $workshop = ptcWorkshop($org);
    $tier     = ptcActiveTier($workshop, 30000);
    $cart     = ptcMakeCart($user, $org);

    Cache::forget("price_resolution_{$workshop->id}");

    $item = app(CartService::class)->addWorkshop($cart, $workshop);

    expect($item->applied_tier_id)->toBe($tier->id);
    expect($item->applied_tier_label)->toBe('Early Bird');
    expect($item->is_tier_price)->toBeTrue();
    expect($item->unit_price_cents)->toBe(30000);
});

test('cart:tier cart item uses base price when no active tier exists', function () {
    [$org, $user] = ptcOrg();
    $workshop = ptcWorkshop($org, 50000);
    $cart     = ptcMakeCart($user, $org);

    Cache::forget("price_resolution_{$workshop->id}");

    $item = app(CartService::class)->addWorkshop($cart, $workshop);

    expect($item->applied_tier_id)->toBeNull();
    expect($item->is_tier_price)->toBeFalse();
    expect($item->unit_price_cents)->toBe(50000);
});

test('cart:tier locked tier price on existing CartItem is unchanged after tier expires', function () {
    [$org, $user] = ptcOrg();
    $workshop = ptcWorkshop($org);
    $tier     = ptcActiveTier($workshop, 30000);
    $cart     = ptcMakeCart($user, $org);

    Cache::forget("price_resolution_{$workshop->id}");
    $item = app(CartService::class)->addWorkshop($cart, $workshop);
    expect($item->unit_price_cents)->toBe(30000);

    // Expire the tier.
    $tier->update(['valid_until' => now()->subMinute()]);
    app(PriceResolutionService::class)->bustCache($workshop->id);

    // Existing CartItem retains the locked tier price.
    expect($item->fresh()->unit_price_cents)->toBe(30000);
    expect($item->fresh()->is_tier_price)->toBeTrue();
});

test('cart:tier N-70 job scheduled when rebuilt cart has a higher price than abandoned cart', function () {
    [$org, $user] = ptcOrg();
    $workshop = ptcWorkshop($org, 50000);

    // First cart uses a tier at 30000.
    $tier = ptcActiveTier($workshop, 30000);
    Cache::forget("price_resolution_{$workshop->id}");
    $cart1 = ptcMakeCart($user, $org);
    app(CartService::class)->addWorkshop($cart1, $workshop);
    $cart1->update(['status' => 'abandoned']);

    // Expire the tier — price reverts to base 50000 (higher than abandoned cart's 30000).
    $tier->update(['valid_until' => now()->subMinute()]);
    app(PriceResolutionService::class)->bustCache($workshop->id);
    Cache::forget("registration_count_{$workshop->id}");

    // Rebuild cart — 50000 > 30000 should trigger N-70.
    $cart2 = ptcMakeCart($user, $org);
    app(CartService::class)->addWorkshop($cart2, $workshop);

    $job = ScheduledPaymentJob::where('notification_code', 'N-70')
        ->where('user_id', $user->id)
        ->where('related_entity_id', $workshop->id)
        ->first();

    expect($job)->not->toBeNull();
});

test('cart:tier no N-70 job scheduled when rebuilt cart price is the same', function () {
    [$org, $user] = ptcOrg();
    $workshop = ptcWorkshop($org, 50000);

    // First cart at base price.
    Cache::forget("price_resolution_{$workshop->id}");
    $cart1 = ptcMakeCart($user, $org);
    app(CartService::class)->addWorkshop($cart1, $workshop);
    $cart1->update(['status' => 'abandoned']);

    // Second cart — same base price, no increase.
    Cache::forget("price_resolution_{$workshop->id}");
    $cart2 = ptcMakeCart($user, $org);
    app(CartService::class)->addWorkshop($cart2, $workshop);

    $job = ScheduledPaymentJob::where('notification_code', 'N-70')
        ->where('user_id', $user->id)
        ->where('related_entity_id', $workshop->id)
        ->first();

    expect($job)->toBeNull();
});
