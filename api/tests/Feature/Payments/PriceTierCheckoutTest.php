<?php

use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\OrderItem;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\CheckoutService;
use App\Domain\Payments\Services\OrderNumberService;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ptcoOrg(): array
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

function ptcoWorkshop(Organization $org): Workshop
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

function ptcoTier(Workshop $workshop, array $overrides = []): WorkshopPriceTier
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

function ptcoOrder(User $user, Organization $org): Order
{
    return Order::create([
        'user_id'         => $user->id,
        'organization_id' => $org->id,
        'order_number'    => app(OrderNumberService::class)->generateOrderNumber(),
        'status'          => 'pending',
        'payment_method'  => 'free',
        'subtotal_cents'  => 0,
        'total_cents'     => 0,
        'currency'        => 'usd',
    ]);
}

function ptcoFreeCart(User $user, Organization $org): Cart
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

test('checkout:tier free checkout with tier CartItem creates order item with tier fields', function () {
    Queue::fake();

    [$org, $user] = ptcoOrg();
    $workshop = ptcoWorkshop($org);
    $tier     = ptcoTier($workshop);

    $cart = ptcoFreeCart($user, $org);

    CartItem::create([
        'cart_id'            => $cart->id,
        'item_type'          => 'workshop_registration',
        'workshop_id'        => $workshop->id,
        'unit_price_cents'   => 0,
        'quantity'           => 1,
        'line_total_cents'   => 0,
        'currency'           => 'usd',
        'applied_tier_id'    => $tier->id,
        'applied_tier_label' => 'Early Bird',
        'is_tier_price'      => true,
    ]);

    $result = app(CheckoutService::class)->checkout($cart, $user);

    $orderItem = $result->order->items->first();

    expect($orderItem)->not->toBeNull();
    expect($orderItem->applied_tier_label)->toBe('Early Bird');
    expect($orderItem->is_tier_price)->toBeTrue();
    expect($orderItem->applied_tier_id)->toBe($tier->id);
});

test('checkout:tier fulfillOrder increments registrations_at_tier on the applied tier', function () {
    Queue::fake();

    [$org, $user] = ptcoOrg();
    $workshop = ptcoWorkshop($org);
    $tier     = ptcoTier($workshop);
    $order    = ptcoOrder($user, $org);

    OrderItem::create([
        'order_id'           => $order->id,
        'item_type'          => 'workshop_registration',
        'workshop_id'        => $workshop->id,
        'unit_price_cents'   => 30000,
        'quantity'           => 1,
        'line_total_cents'   => 30000,
        'currency'           => 'usd',
        'applied_tier_id'    => $tier->id,
        'applied_tier_label' => 'Early Bird',
        'is_tier_price'      => true,
    ]);

    app(CheckoutService::class)->fulfillOrder($order);

    expect($tier->fresh()->registrations_at_tier)->toBe(1);
});

test('checkout:tier fulfillOrder creates capacity-reached notification when tier fills up', function () {
    Queue::fake();

    [$org, $user] = ptcoOrg();
    $workshop = ptcoWorkshop($org);
    $tier     = ptcoTier($workshop, ['capacity_limit' => 1, 'valid_until' => null]);

    // One registration already exists so fulfillOrder will push count to 1 = capacity.
    Registration::create([
        'user_id'             => $user->id,
        'workshop_id'         => $workshop->id,
        'registration_status' => 'registered',
        'registered_at'       => now(),
    ]);

    $order = ptcoOrder($user, $org);

    OrderItem::create([
        'order_id'           => $order->id,
        'item_type'          => 'workshop_registration',
        'workshop_id'        => $workshop->id,
        'unit_price_cents'   => 30000,
        'quantity'           => 1,
        'line_total_cents'   => 30000,
        'currency'           => 'usd',
        'applied_tier_id'    => $tier->id,
        'applied_tier_label' => 'Early Bird',
        'is_tier_price'      => true,
    ]);

    app(CheckoutService::class)->fulfillOrder($order);

    $notification = Notification::where('workshop_id', $workshop->id)
        ->whereRaw("title LIKE ?", ['%Early Bird%'])
        ->first();

    expect($notification)->not->toBeNull();
    expect($notification->message)->toContain('now full');
});

test('checkout:tier fulfillOrder does not notify when tier capacity is not reached', function () {
    Queue::fake();

    [$org, $user] = ptcoOrg();
    $workshop = ptcoWorkshop($org);
    $tier     = ptcoTier($workshop, ['capacity_limit' => 10, 'valid_until' => null]);
    $order    = ptcoOrder($user, $org);

    OrderItem::create([
        'order_id'           => $order->id,
        'item_type'          => 'workshop_registration',
        'workshop_id'        => $workshop->id,
        'unit_price_cents'   => 30000,
        'quantity'           => 1,
        'line_total_cents'   => 30000,
        'currency'           => 'usd',
        'applied_tier_id'    => $tier->id,
        'applied_tier_label' => 'Early Bird',
        'is_tier_price'      => true,
    ]);

    app(CheckoutService::class)->fulfillOrder($order);

    expect(Notification::where('workshop_id', $workshop->id)->count())->toBe(0);
});

test('checkout:tier order item applied_tier_label is present in order show response', function () {
    Queue::fake();

    [$org, $user] = ptcoOrg();
    $workshop = ptcoWorkshop($org);
    $tier     = ptcoTier($workshop);

    $cart = ptcoFreeCart($user, $org);

    CartItem::create([
        'cart_id'            => $cart->id,
        'item_type'          => 'workshop_registration',
        'workshop_id'        => $workshop->id,
        'unit_price_cents'   => 0,
        'quantity'           => 1,
        'line_total_cents'   => 0,
        'currency'           => 'usd',
        'applied_tier_id'    => $tier->id,
        'applied_tier_label' => 'Early Bird',
        'is_tier_price'      => true,
    ]);

    $result = app(CheckoutService::class)->checkout($cart, $user);

    $this->actingAs($user)
        ->getJson("/api/v1/orders/{$result->order->order_number}")
        ->assertOk()
        ->assertJsonFragment(['applied_tier_label' => 'Early Bird']);
});
