<?php

use App\Domain\Payments\Models\Coupon;
use App\Domain\Payments\Models\CouponRedemption;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(function () {
    Cache::forget('payment_flag.platform.payments_enabled');
});

function wrdOrg(string $role = 'owner'): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    if ($role !== 'none') {
        OrganizationUser::factory()->create([
            'organization_id' => $org->id,
            'user_id'         => $user->id,
            'role'            => $role,
            'is_active'       => true,
        ]);
    }

    wrdEnablePayments($org);

    return [$org, $user];
}

function wrdEnablePayments(Organization $org): void
{
    PaymentFeatureFlag::firstOrCreate(
        ['scope' => 'platform', 'flag_key' => 'payments_enabled'],
        ['is_enabled' => true],
    );

    PaymentFeatureFlag::firstOrCreate(
        ['scope' => 'organization', 'organization_id' => $org->id, 'flag_key' => 'org_payments_enabled'],
        ['is_enabled' => true, 'enabled_at' => now()],
    );
}

function wrdWorkshop(Organization $org): Workshop
{
    return Workshop::factory()->create(['organization_id' => $org->id]);
}

function wrdCoupon(Organization $org, User $creator, array $attrs = []): Coupon
{
    static $seq = 0;
    $seq++;

    return Coupon::create(array_merge([
        'organization_id'    => $org->id,
        'created_by_user_id' => $creator->id,
        'code'               => 'WRD' . $seq,
        'label'              => 'WRD Coupon ' . $seq,
        'discount_type'      => 'percentage',
        'discount_pct'       => 10.00,
        'is_active'          => true,
    ], $attrs));
}

function wrdOrder(User $user, Organization $org, array $attrs = []): Order
{
    static $seq = 0;
    $seq++;

    return Order::create(array_merge([
        'order_number'           => 'WF-WRD-' . str_pad($seq, 6, '0', STR_PAD_LEFT),
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
        'completed_at'           => now(),
    ], $attrs));
}

function wrdRedemption(
    Coupon $coupon,
    Order $order,
    User $user,
    Organization $org,
    Workshop $workshop,
    array $attrs = [],
): CouponRedemption {
    return CouponRedemption::create(array_merge([
        'coupon_id'                  => $coupon->id,
        'order_id'                   => $order->id,
        'user_id'                    => $user->id,
        'organization_id'            => $org->id,
        'workshop_id'                => $workshop->id,
        'discount_amount_cents'      => 1000,
        'pre_discount_subtotal_cents' => 10000,
        'post_discount_total_cents'  => 9000,
        'coupon_code_snapshot'       => $coupon->code,
        'discount_type_snapshot'     => $coupon->discount_type,
    ], $attrs));
}

// ─── GET /workshops/{workshop}/coupon-redemptions ─────────────────────────────

it('returns redemptions for the requested workshop only', function () {
    [$org, $user] = wrdOrg('owner');
    $workshop     = wrdWorkshop($org);
    $other        = wrdWorkshop($org);
    $coupon       = wrdCoupon($org, $user);
    $buyer        = User::factory()->create();
    $order        = wrdOrder($buyer, $org);
    $otherOrder   = wrdOrder($buyer, $org);

    wrdRedemption($coupon, $order,      $buyer, $org, $workshop);
    wrdRedemption($coupon, $otherOrder, $buyer, $org, $other);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/coupon-redemptions");

    $response->assertOk();
    expect($response->json('meta.total'))->toBe(1);
    expect($response->json('data.0.workshop_id'))->toBe($workshop->id);
});

it('returns correct summary totals', function () {
    [$org, $user] = wrdOrg('owner');
    $workshop     = wrdWorkshop($org);
    $couponA      = wrdCoupon($org, $user);
    $couponB      = wrdCoupon($org, $user);
    $buyer        = User::factory()->create();

    foreach ([$couponA, $couponB] as $coupon) {
        $order = wrdOrder($buyer, $org);
        wrdRedemption($coupon, $order, $buyer, $org, $workshop, [
            'discount_amount_cents' => 2000,
        ]);
    }

    $response = $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/coupon-redemptions");

    $response->assertOk();
    $summary = $response->json('meta.summary');

    expect($summary['total_redemptions'])->toBe(2);
    expect($summary['total_discount_cents'])->toBe(4000);
    expect($summary['unique_coupons_used'])->toBe(2);
});

it('returns meta.total of 0 when workshop has no redemptions', function () {
    [$org, $user] = wrdOrg('owner');
    $workshop     = wrdWorkshop($org);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/coupon-redemptions");

    $response->assertOk();
    expect($response->json('meta.total'))->toBe(0);
    expect($response->json('meta.summary.total_redemptions'))->toBe(0);
    expect($response->json('meta.summary.unique_coupons_used'))->toBe(0);
});

it('allows staff to access workshop coupon redemptions', function () {
    [$org, $user] = wrdOrg('staff');
    $workshop     = wrdWorkshop($org);

    $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/coupon-redemptions")
        ->assertOk();
});

it('rejects billing_admin from workshop coupon redemptions', function () {
    [$org, $user] = wrdOrg('billing_admin');
    $workshop     = wrdWorkshop($org);

    $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/coupon-redemptions")
        ->assertForbidden();
});

it('rejects cross-org workshop access', function () {
    [$org, $user]   = wrdOrg('owner');
    [$other]        = wrdOrg('owner');
    $foreignWorkshop = wrdWorkshop($other);

    $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$foreignWorkshop->id}/coupon-redemptions")
        ->assertForbidden();
});

// ─── GET /coupons/{coupon}/redemptions?workshop_id= ───────────────────────────

it('filters coupon redemptions by workshop_id', function () {
    [$org, $user] = wrdOrg('owner');
    $coupon       = wrdCoupon($org, $user);
    $workshopA    = wrdWorkshop($org);
    $workshopB    = wrdWorkshop($org);
    $buyer        = User::factory()->create();

    wrdRedemption($coupon, wrdOrder($buyer, $org), $buyer, $org, $workshopA);
    wrdRedemption($coupon, wrdOrder($buyer, $org), $buyer, $org, $workshopB);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/{$coupon->id}/redemptions?workshop_id={$workshopA->id}");

    $response->assertOk();
    expect($response->json('meta.total'))->toBe(1);
});

it('returns all redemptions when no workshop_id filter is given', function () {
    [$org, $user] = wrdOrg('owner');
    $coupon       = wrdCoupon($org, $user);
    $workshopA    = wrdWorkshop($org);
    $workshopB    = wrdWorkshop($org);
    $buyer        = User::factory()->create();

    wrdRedemption($coupon, wrdOrder($buyer, $org), $buyer, $org, $workshopA);
    wrdRedemption($coupon, wrdOrder($buyer, $org), $buyer, $org, $workshopB);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/{$coupon->id}/redemptions");

    $response->assertOk();
    expect($response->json('meta.total'))->toBe(2);
});
