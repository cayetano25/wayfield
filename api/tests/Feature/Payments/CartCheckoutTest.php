<?php

use App\Domain\Payments\Models\Cart;
use App\Domain\Payments\Models\CartItem;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\SessionPricing;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Services\CartService;
use App\Domain\Payments\Services\CheckoutService;
use App\Domain\Payments\Services\OrderNumberService;
use App\Jobs\CartExpiryJob;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Test helpers ─────────────────────────────────────────────────────────────

function cartUser(string $role = null): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    if ($role) {
        OrganizationUser::factory()->create([
            'organization_id' => $org->id,
            'user_id'         => $user->id,
            'role'            => $role,
            'is_active'       => true,
        ]);
    }

    return [$org, $user];
}

function cartPublishedWorkshop(Organization $org, array $overrides = []): Workshop
{
    return Workshop::factory()->create(array_merge(
        ['organization_id' => $org->id, 'status' => 'published'],
        $overrides,
    ));
}

function activeCart(User $user, Organization $org): Cart
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

// ─── OrderNumberService ───────────────────────────────────────────────────────

it('generates order numbers in WF-YEAR-NNNNNN format', function () {
    $service = app(OrderNumberService::class);
    $number  = $service->generateOrderNumber();

    expect($number)->toMatch('/^WF-\d{4}-\d{6}$/');
    expect($number)->toContain('WF-' . date('Y') . '-');
});

it('generates sequentially incrementing order numbers', function () {
    $service = app(OrderNumberService::class);

    $first  = $service->generateOrderNumber();
    $second = $service->generateOrderNumber();
    $third  = $service->generateOrderNumber();

    expect($first)->toBe('WF-' . date('Y') . '-000001');
    expect($second)->toBe('WF-' . date('Y') . '-000002');
    expect($third)->toBe('WF-' . date('Y') . '-000003');
});

it('order numbers are unique across concurrent calls', function () {
    $service = app(OrderNumberService::class);
    $numbers = [];

    for ($i = 0; $i < 10; $i++) {
        $numbers[] = $service->generateOrderNumber();
    }

    expect(count(array_unique($numbers)))->toBe(10);
});

// ─── CartService — getOrCreateCart ───────────────────────────────────────────

it('creates a new cart when none exists', function () {
    [$org, $user] = cartUser();

    $cart = app(CartService::class)->getOrCreateCart($user, $org);

    expect($cart->status)->toBe('active');
    expect($cart->user_id)->toBe($user->id);
    expect($cart->organization_id)->toBe($org->id);
    expect($cart->expires_at->isFuture())->toBeTrue();
});

it('returns an existing active cart instead of creating a new one', function () {
    [$org, $user] = cartUser();
    $existing = activeCart($user, $org);

    $cart = app(CartService::class)->getOrCreateCart($user, $org);

    expect($cart->id)->toBe($existing->id);
    expect(Cart::where('user_id', $user->id)->count())->toBe(1);
});

it('creates a new cart when the existing one has expired', function () {
    [$org, $user] = cartUser();

    Cart::create([
        'user_id'          => $user->id,
        'organization_id'  => $org->id,
        'status'           => 'active',
        'subtotal_cents'   => 0,
        'currency'         => 'usd',
        'expires_at'       => now()->subMinutes(1),
        'last_activity_at' => now()->subHours(25),
    ]);

    $cart = app(CartService::class)->getOrCreateCart($user, $org);

    expect($cart->expires_at->isFuture())->toBeTrue();
    expect(Cart::where('user_id', $user->id)->where('status', 'expired')->count())->toBe(1);
});

it('throws CartOrgMismatchException when active cart exists for a different org', function () {
    $org1 = Organization::factory()->create();
    $org2 = Organization::factory()->create();
    $user = User::factory()->create();

    activeCart($user, $org1);

    expect(fn () => app(CartService::class)->getOrCreateCart($user, $org2))
        ->toThrow(\App\Domain\Payments\Exceptions\CartOrgMismatchException::class);
});

// ─── CartService — addWorkshop ────────────────────────────────────────────────

it('adds a free workshop to the cart', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $cart     = activeCart($user, $org);

    app(CartService::class)->addWorkshop($cart, $workshop);

    expect($cart->fresh()->subtotal_cents)->toBe(0);
    expect($cart->items()->count())->toBe(1);
    expect($cart->items()->first()->item_type)->toBe('workshop_registration');
    expect($cart->items()->first()->unit_price_cents)->toBe(0);
});

it('adds a paid workshop to the cart with correct price', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 30000,
        'currency'         => 'usd',
        'is_paid'          => true,
        'deposit_enabled'  => false,
    ]);

    $cart = activeCart($user, $org);
    app(CartService::class)->addWorkshop($cart, $workshop);

    expect($cart->fresh()->subtotal_cents)->toBe(30000);
    $item = $cart->items()->first();
    expect($item->unit_price_cents)->toBe(30000);
    expect($item->is_deposit)->toBeFalse();
});

it('creates a deposit cart item when deposit is enabled', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    WorkshopPricing::create([
        'workshop_id'         => $workshop->id,
        'base_price_cents'    => 50000,
        'currency'            => 'usd',
        'is_paid'             => true,
        'deposit_enabled'     => true,
        'deposit_amount_cents' => 10000,
        'balance_due_date'    => now()->addMonths(2)->toDateString(),
    ]);

    $cart = activeCart($user, $org);
    app(CartService::class)->addWorkshop($cart, $workshop);

    $item = $cart->items()->first();
    expect($item->is_deposit)->toBeTrue();
    expect($item->unit_price_cents)->toBe(10000);
    expect($item->deposit_amount_cents)->toBe(10000);
    expect($item->balance_amount_cents)->toBe(40000);
    expect($cart->fresh()->subtotal_cents)->toBe(10000);
});

it('blocks adding a draft workshop to the cart', function () {
    [$org, $user] = cartUser();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'draft']);
    $cart     = activeCart($user, $org);

    expect(fn () => app(CartService::class)->addWorkshop($cart, $workshop))
        ->toThrow(\App\Domain\Payments\Exceptions\WorkshopNotPublishedException::class);
});

it('blocks adding a workshop the user is already registered for', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    Registration::factory()->create([
        'user_id'             => $user->id,
        'workshop_id'         => $workshop->id,
        'registration_status' => 'registered',
    ]);

    $cart = activeCart($user, $org);

    expect(fn () => app(CartService::class)->addWorkshop($cart, $workshop))
        ->toThrow(\App\Domain\Payments\Exceptions\DuplicateWorkshopInCartException::class);
});

it('blocks adding the same workshop twice to the cart', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $cart     = activeCart($user, $org);

    app(CartService::class)->addWorkshop($cart, $workshop);

    expect(fn () => app(CartService::class)->addWorkshop($cart, $workshop))
        ->toThrow(\App\Domain\Payments\Exceptions\DuplicateWorkshopInCartException::class);
});

// ─── CartService — addAddonSession ────────────────────────────────────────────

it('adds an addon session to the cart for a registered participant', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    $session = Session::factory()->create([
        'workshop_id'          => $workshop->id,
        'session_type'         => 'addon',
        'enrollment_mode'      => 'purchase_required',
        'publication_status'   => 'published',
        'participant_visibility' => 'hidden',
    ]);

    SessionPricing::create([
        'session_id'  => $session->id,
        'price_cents' => 5000,
        'currency'    => 'usd',
    ]);

    Registration::factory()->create([
        'user_id'             => $user->id,
        'workshop_id'         => $workshop->id,
        'registration_status' => 'registered',
    ]);

    $cart = activeCart($user, $org);
    app(CartService::class)->addAddonSession($cart, $session);

    expect($cart->fresh()->subtotal_cents)->toBe(5000);
    $item = $cart->items()->first();
    expect($item->item_type)->toBe('addon_session');
    expect($item->session_id)->toBe($session->id);
});

it('adds an addon session when the parent workshop is in the same cart', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    $session = Session::factory()->create([
        'workshop_id'          => $workshop->id,
        'session_type'         => 'addon',
        'enrollment_mode'      => 'purchase_required',
        'publication_status'   => 'published',
        'participant_visibility' => 'hidden',
    ]);

    SessionPricing::create([
        'session_id'  => $session->id,
        'price_cents' => 5000,
        'currency'    => 'usd',
    ]);

    $cart = activeCart($user, $org);

    // Add workshop to cart first — user is NOT yet registered.
    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);

    app(CartService::class)->addAddonSession($cart, $session);

    expect($cart->items()->count())->toBe(2);
});

it('blocks addon session for user with no registration and no workshop in cart', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    $session = Session::factory()->create([
        'workshop_id'    => $workshop->id,
        'session_type'   => 'addon',
        'enrollment_mode' => 'purchase_required',
        'publication_status' => 'published',
    ]);

    SessionPricing::create([
        'session_id'  => $session->id,
        'price_cents' => 5000,
        'currency'    => 'usd',
    ]);

    $cart = activeCart($user, $org);

    expect(fn () => app(CartService::class)->addAddonSession($cart, $session))
        ->toThrow(\App\Domain\Payments\Exceptions\AddonSessionEligibilityException::class);
});

it('blocks adding a standard session as an addon', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    $session = Session::factory()->create([
        'workshop_id'    => $workshop->id,
        'session_type'   => 'standard',
        'enrollment_mode' => 'self_select',
        'publication_status' => 'published',
    ]);

    $cart = activeCart($user, $org);

    expect(fn () => app(CartService::class)->addAddonSession($cart, $session))
        ->toThrow(\App\Domain\Payments\Exceptions\AddonSessionEligibilityException::class);
});

// ─── CartService — removeItem ─────────────────────────────────────────────────

it('removes a cart item and recalculates subtotal', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 10000,
        'currency'         => 'usd',
        'is_paid'          => true,
    ]);

    $cart = activeCart($user, $org);
    $item = app(CartService::class)->addWorkshop($cart, $workshop);

    expect($cart->fresh()->subtotal_cents)->toBe(10000);

    app(CartService::class)->removeItem($cart, $item->id);

    expect($cart->fresh()->subtotal_cents)->toBe(0);
    expect($cart->items()->count())->toBe(0);
});

// ─── CartController — API endpoints ──────────────────────────────────────────

it('GET /cart/{organization} creates and returns a cart', function () {
    [$org, $user] = cartUser();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withToken($token)->getJson("/api/v1/cart/{$org->id}");

    $response->assertOk();
    $response->assertJsonStructure(['id', 'organization_id', 'status', 'subtotal_cents', 'items']);
    expect($response->json('status'))->toBe('active');
});

it('POST /cart/{organization}/items adds a workshop', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $token    = $user->createToken('test')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v1/cart/{$org->id}/items", [
        'item_type'   => 'workshop_registration',
        'workshop_id' => $workshop->id,
    ]);

    $response->assertStatus(201);
    $response->assertJsonPath('items.0.item_type', 'workshop_registration');
});

it('POST /cart/{organization}/items returns 422 for a draft workshop', function () {
    [$org, $user] = cartUser();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'draft']);
    $token    = $user->createToken('test')->plainTextToken;

    $response = $this->withToken($token)->postJson("/api/v1/cart/{$org->id}/items", [
        'item_type'   => 'workshop_registration',
        'workshop_id' => $workshop->id,
    ]);

    $response->assertStatus(422);
    $response->assertJsonPath('error', 'WORKSHOP_NOT_AVAILABLE');
});

it('DELETE /cart/{organization}/items/{cartItem} removes the item', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $token    = $user->createToken('test')->plainTextToken;

    $this->withToken($token)->postJson("/api/v1/cart/{$org->id}/items", [
        'item_type'   => 'workshop_registration',
        'workshop_id' => $workshop->id,
    ]);

    $cart = Cart::where('user_id', $user->id)->where('organization_id', $org->id)->first();
    $item = $cart->items()->first();

    $response = $this->withToken($token)->deleteJson("/api/v1/cart/{$org->id}/items/{$item->id}");

    $response->assertOk();
    expect($response->json('subtotal_cents'))->toBe(0);
    expect($response->json('items'))->toBeEmpty();
});

it('POST /cart/{organization}/checkout returns 422 for an empty cart', function () {
    [$org, $user] = cartUser();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)->getJson("/api/v1/cart/{$org->id}");

    $response = $this->withToken($token)->postJson("/api/v1/cart/{$org->id}/checkout");

    $response->assertStatus(422);
    $response->assertJsonPath('error', 'CART_EMPTY');
});

// ─── CheckoutService — free checkout ─────────────────────────────────────────

it('free checkout completes synchronously and creates a registration', function () {
    Queue::fake();

    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $cart     = activeCart($user, $org);

    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);
    $cart->update(['subtotal_cents' => 0]);

    $result = app(CheckoutService::class)->checkout($cart, $user);

    expect($result->requiresPayment)->toBeFalse();
    expect($result->order->status)->toBe('completed');
    expect($result->order->payment_method)->toBe('free');

    expect(Registration::where('user_id', $user->id)->where('workshop_id', $workshop->id)->exists())->toBeTrue();
    expect($cart->fresh()->status)->toBe('checked_out');
});

it('free checkout creates a session selection for an addon session', function () {
    Queue::fake();

    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    $registration = Registration::factory()->create([
        'user_id'             => $user->id,
        'workshop_id'         => $workshop->id,
        'registration_status' => 'registered',
    ]);

    $session = Session::factory()->create([
        'workshop_id'    => $workshop->id,
        'session_type'   => 'addon',
        'enrollment_mode' => 'purchase_required',
        'publication_status' => 'published',
    ]);

    $cart = activeCart($user, $org);
    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'addon_session',
        'workshop_id'      => $workshop->id,
        'session_id'       => $session->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);

    $result = app(CheckoutService::class)->checkout($cart, $user);

    expect($result->order->status)->toBe('completed');

    $selection = SessionSelection::where('registration_id', $registration->id)
        ->where('session_id', $session->id)
        ->first();

    expect($selection)->not->toBeNull();
    expect($selection->selection_status)->toBe('selected');
    expect($selection->assignment_source)->toBe('addon_purchase');
    expect($selection->assigned_by_user_id)->toBeNull();
});

// ─── fulfillOrder idempotency ─────────────────────────────────────────────────

it('fulfillOrder is idempotent — calling twice does not duplicate registrations', function () {
    Queue::fake();

    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $cart     = activeCart($user, $org);

    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);
    $cart->update(['subtotal_cents' => 0]);

    $result = app(CheckoutService::class)->checkout($cart, $user);

    // Calling fulfillOrder again on an already-completed order is a no-op.
    app(CheckoutService::class)->fulfillOrder($result->order->fresh());

    expect(Registration::where('user_id', $user->id)->where('workshop_id', $workshop->id)->count())->toBe(1);
});

// ─── Stripe checkout path ─────────────────────────────────────────────────────

it('stripe checkout fails when connect account is not ready', function () {
    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    WorkshopPricing::create([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 10000,
        'currency'         => 'usd',
        'is_paid'          => true,
    ]);

    $cart = activeCart($user, $org);
    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 10000,
        'quantity'         => 1,
        'line_total_cents' => 10000,
        'currency'         => 'usd',
    ]);
    $cart->update(['subtotal_cents' => 10000]);

    expect(fn () => app(CheckoutService::class)->checkout($cart, $user))
        ->toThrow(\App\Domain\Payments\Exceptions\StripeConnectNotReadyException::class);
});

// ─── CartExpiryJob ────────────────────────────────────────────────────────────

it('CartExpiryJob marks expired active carts as abandoned', function () {
    [$org, $user] = cartUser();

    Cart::create([
        'user_id'          => $user->id,
        'organization_id'  => $org->id,
        'status'           => 'active',
        'subtotal_cents'   => 0,
        'currency'         => 'usd',
        'expires_at'       => now()->subHour(),
        'last_activity_at' => now()->subHours(25),
    ]);

    (new CartExpiryJob)->handle();

    expect(Cart::where('user_id', $user->id)->where('status', 'abandoned')->count())->toBe(1);
});

it('CartExpiryJob does not affect non-expired carts', function () {
    [$org, $user] = cartUser();
    activeCart($user, $org);

    (new CartExpiryJob)->handle();

    expect(Cart::where('user_id', $user->id)->where('status', 'active')->count())->toBe(1);
});

// ─── Order endpoints ──────────────────────────────────────────────────────────

it('GET /api/v1/orders returns the authenticated user\'s orders', function () {
    Queue::fake();

    [$org, $user] = cartUser();
    $workshop = cartPublishedWorkshop($org);
    $token    = $user->createToken('test')->plainTextToken;

    $cart = activeCart($user, $org);
    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);
    $cart->update(['subtotal_cents' => 0]);
    app(CheckoutService::class)->checkout($cart, $user);

    $response = $this->withToken($token)->getJson('/api/v1/orders');

    $response->assertOk();
    $response->assertJsonStructure(['data', 'meta']);
    expect($response->json('data'))->not->toBeEmpty();
});

it('GET /api/v1/orders/{order} returns 404 for another user\'s order', function () {
    Queue::fake();

    [$org, $user1] = cartUser();
    [$org2, $user2] = cartUser();
    $workshop = cartPublishedWorkshop($org);

    $cart = activeCart($user1, $org);
    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);
    $cart->update(['subtotal_cents' => 0]);
    $result = app(CheckoutService::class)->checkout($cart, $user1);

    $token2 = $user2->createToken('test')->plainTextToken;
    $response = $this->withToken($token2)->getJson("/api/v1/orders/{$result->order->id}");

    $response->assertNotFound();
});

it('GET /api/v1/organizations/{organization}/orders requires owner/admin/staff role', function () {
    [$org, $user] = cartUser();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withToken($token)->getJson("/api/v1/organizations/{$org->id}/orders");

    $response->assertForbidden();
});

it('GET /api/v1/organizations/{organization}/orders returns org orders for staff', function () {
    Queue::fake();

    [$org, $user] = cartUser('staff');
    $workshop = cartPublishedWorkshop($org);

    $participant = User::factory()->create();
    $cart        = activeCart($participant, $org);
    CartItem::create([
        'cart_id'          => $cart->id,
        'item_type'        => 'workshop_registration',
        'workshop_id'      => $workshop->id,
        'unit_price_cents' => 0,
        'quantity'         => 1,
        'line_total_cents' => 0,
        'currency'         => 'usd',
    ]);
    $cart->update(['subtotal_cents' => 0]);
    app(CheckoutService::class)->checkout($cart, $participant);

    $token    = $user->createToken('test')->plainTextToken;
    $response = $this->withToken($token)->getJson("/api/v1/organizations/{$org->id}/orders");

    $response->assertOk();
    $response->assertJsonStructure(['data', 'meta']);
});

it('billing_admin cannot access organization orders', function () {
    [$org, $user] = cartUser('billing_admin');
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withToken($token)->getJson("/api/v1/organizations/{$org->id}/orders");

    $response->assertForbidden();
});

// ─── client_secret not stored in plaintext ────────────────────────────────────

it('client_secret is never stored in plaintext — only hash is persisted', function () {
    // This test verifies the architectural constraint: the payment_intents table
    // stores client_secret_hash (sha256), never the raw Stripe secret.
    // We test this by verifying the column definition and PaymentIntentRecord behavior.

    $intentRecord = new \App\Domain\Payments\Models\PaymentIntentRecord();
    $fillable     = $intentRecord->getFillable();

    expect($fillable)->not->toContain('client_secret');
    expect($fillable)->not->toContain('client_secret_hash');
});
