<?php

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\OrderItem;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function statusWorkshop(): Workshop
{
    return Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'status-' . uniqid(),
    ]);
}

function statusOrder(User $user, Organization $org, Workshop $workshop, array $attrs = []): Order
{
    static $seq = 0;
    $seq++;

    $order = Order::create(array_merge([
        'order_number'           => 'WF-STATUS-' . str_pad($seq, 6, '0', STR_PAD_LEFT),
        'user_id'                => $user->id,
        'organization_id'        => $org->id,
        'status'                 => 'completed',
        'payment_method'         => 'stripe',
        'subtotal_cents'         => 10000,
        'wayfield_fee_cents'     => 500,
        'stripe_fee_cents'       => 320,
        'total_cents'            => 10000,
        'organizer_payout_cents' => 9180,
        'take_rate_pct'          => 0.05,
        'currency'               => 'usd',
        'is_deposit_order'       => false,
        'completed_at'           => now(),
    ], $attrs));

    OrderItem::create([
        'order_id'        => $order->id,
        'item_type'       => 'workshop',
        'workshop_id'     => $workshop->id,
        'unit_price_cents' => 10000,
        'quantity'        => 1,
        'line_total_cents' => 10000,
        'currency'        => 'usd',
    ]);

    return $order;
}

// ─── participant_status null cases ────────────────────────────────────────────

test('participant_status is null when not authenticated', function () {
    $workshop = statusWorkshop();

    $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200)
        ->assertJsonPath('participant_status', null);
});

test('participant_status is null when authenticated but not registered', function () {
    $user     = User::factory()->create();
    $workshop = statusWorkshop();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200)
        ->assertJsonPath('participant_status', null);
});

// ─── participant_status present cases ────────────────────────────────────────

test('participant_status.registration_status is registered when registered', function () {
    $user     = User::factory()->create();
    $workshop = statusWorkshop();

    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create([
        'registration_status' => 'registered',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200)
        ->assertJsonPath('participant_status.registration_status', 'registered');
});

test('participant_status.payment_status is free when no completed order exists', function () {
    $user     = User::factory()->create();
    $workshop = statusWorkshop();

    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    expect($response->json('participant_status.payment_status'))->toBe('free');
    expect($response->json('participant_status.is_paid'))->toBeFalse();
});

test('participant_status.payment_status is Fully Paid when completed order exists', function () {
    $user     = User::factory()->create();
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'paid-workshop-' . uniqid(),
    ]);

    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    statusOrder($user, $org, $workshop);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    expect($response->json('participant_status.payment_status'))->toBe('Fully Paid');
    expect($response->json('participant_status.is_paid'))->toBeTrue();
});

test('participant_status.is_deposit_only is true for deposit-only order', function () {
    $user     = User::factory()->create();
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'deposit-workshop-' . uniqid(),
    ]);

    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    statusOrder($user, $org, $workshop, [
        'is_deposit_order' => true,
        'deposit_paid_at'  => now(),
        'balance_paid_at'  => null,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    expect($response->json('participant_status.is_deposit_only'))->toBeTrue();
});
