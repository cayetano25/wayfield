<?php

use App\Domain\Payments\Models\Coupon;
use App\Domain\Payments\Models\CouponRedemption;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(function () {
    Cache::forget('payment_flag.platform.payments_enabled');
});

function analyticsOrg(string $role = 'owner'): array
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

    analyticsEnablePayments($org);

    return [$org, $user];
}

function analyticsEnablePayments(Organization $org): void
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

function analyticsCoupon(Organization $org, User $creator, array $attrs = []): Coupon
{
    static $seq = 0;
    $seq++;

    return Coupon::create(array_merge([
        'organization_id'       => $org->id,
        'created_by_user_id'    => $creator->id,
        'code'                  => 'ANALYTICS' . $seq,
        'label'                 => 'Analytics Coupon ' . $seq,
        'discount_type'         => 'percentage',
        'discount_pct'          => 10.00,
        'is_active'             => true,
    ], $attrs));
}

function analyticsOrder(User $user, Organization $org, array $attrs = []): Order
{
    static $seq = 0;
    $seq++;

    return Order::create(array_merge([
        'order_number'           => 'WF-TEST-' . str_pad($seq, 6, '0', STR_PAD_LEFT),
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

function analyticsRedemption(
    Coupon $coupon,
    Order $order,
    User $user,
    Organization $org,
    array $attrs = [],
): CouponRedemption {
    return CouponRedemption::create(array_merge([
        'coupon_id'                   => $coupon->id,
        'order_id'                    => $order->id,
        'user_id'                     => $user->id,
        'organization_id'             => $org->id,
        'discount_amount_cents'       => 1000,
        'pre_discount_subtotal_cents'  => 10000,
        'post_discount_total_cents'   => 9000,
        'coupon_code_snapshot'        => $coupon->getRawOriginal('code') ?? $coupon->code,
        'discount_type_snapshot'      => $coupon->discount_type,
    ], $attrs));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

it('returns 200 with correct top-level structure for owner', function () {
    [$org, $user] = analyticsOrg('owner');

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics");

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'period',
                'period_from',
                'period_to',
                'total_redemptions',
                'total_discount',
                'total_discount_cents',
                'total_revenue',
                'conversion_rate_pct',
                'orders_with_coupon',
                'total_orders',
                'top_coupon',
                'per_coupon',
            ],
        ]);
});

it('counts total_redemptions correctly for the current period', function () {
    [$org, $user] = analyticsOrg('owner');
    $coupon = analyticsCoupon($org, $user);

    $buyer = User::factory()->create();
    $order = analyticsOrder($buyer, $org, ['coupon_id' => $coupon->id]);
    analyticsRedemption($coupon, $order, $buyer, $org);

    $buyer2 = User::factory()->create();
    $order2 = analyticsOrder($buyer2, $org, ['coupon_id' => $coupon->id]);
    analyticsRedemption($coupon, $order2, $buyer2, $org);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics");

    $response->assertOk()
        ->assertJsonPath('data.total_redemptions', 2);
});

it('sums total_discount_cents correctly across multiple coupons', function () {
    [$org, $user] = analyticsOrg('owner');

    $couponA = analyticsCoupon($org, $user, ['discount_type' => 'percentage', 'discount_pct' => 10]);
    $couponB = analyticsCoupon($org, $user, ['discount_type' => 'percentage', 'discount_pct' => 20]);

    $buyer = User::factory()->create();

    $orderA = analyticsOrder($buyer, $org, ['coupon_id' => $couponA->id]);
    analyticsRedemption($couponA, $orderA, $buyer, $org, ['discount_amount_cents' => 500]);

    $buyer2  = User::factory()->create();
    $orderB  = analyticsOrder($buyer2, $org, ['coupon_id' => $couponB->id]);
    analyticsRedemption($couponB, $orderB, $buyer2, $org, ['discount_amount_cents' => 1500]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics");

    $response->assertOk()
        ->assertJsonPath('data.total_discount_cents', 2000);
});

it('calculates conversion_rate_pct as 50.0 when 1 of 2 orders had a coupon', function () {
    [$org, $user] = analyticsOrg('owner');
    $coupon = analyticsCoupon($org, $user);

    $buyer = User::factory()->create();

    // Order WITH coupon
    $orderWith = analyticsOrder($buyer, $org, ['coupon_id' => $coupon->id]);
    analyticsRedemption($coupon, $orderWith, $buyer, $org);

    // Order WITHOUT coupon
    analyticsOrder($buyer, $org);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics");

    $response->assertOk()
        ->assertJsonPath('data.orders_with_coupon', 1)
        ->assertJsonPath('data.total_orders', 2);

    expect($response->json('data.conversion_rate_pct'))->toEqual(50.0);
});

it('shows the coupon with the most redemptions as top_coupon', function () {
    [$org, $user] = analyticsOrg('owner');

    $topCoupon  = analyticsCoupon($org, $user);
    $otherCoupon = analyticsCoupon($org, $user);

    $buyer  = User::factory()->create();
    $buyer2 = User::factory()->create();
    $buyer3 = User::factory()->create();

    // topCoupon gets 2 redemptions
    $o1 = analyticsOrder($buyer, $org, ['coupon_id' => $topCoupon->id]);
    analyticsRedemption($topCoupon, $o1, $buyer, $org);

    $o2 = analyticsOrder($buyer2, $org, ['coupon_id' => $topCoupon->id]);
    analyticsRedemption($topCoupon, $o2, $buyer2, $org);

    // otherCoupon gets 1 redemption
    $o3 = analyticsOrder($buyer3, $org, ['coupon_id' => $otherCoupon->id]);
    analyticsRedemption($otherCoupon, $o3, $buyer3, $org);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics");

    $response->assertOk()
        ->assertJsonPath('data.top_coupon.coupon_id', $topCoupon->id)
        ->assertJsonPath('data.top_coupon.use_count', 2);
});

it('filters by last_month and excludes current-month redemptions', function () {
    [$org, $user] = analyticsOrg('owner');
    $coupon = analyticsCoupon($org, $user);
    $buyer  = User::factory()->create();

    // Redemption in last month
    $lastMonthOrder = analyticsOrder($buyer, $org, [
        'coupon_id'    => $coupon->id,
        'completed_at' => now()->subMonth()->startOfMonth()->addDays(14),
    ]);
    $redemption = analyticsRedemption($coupon, $lastMonthOrder, $buyer, $org);
    DB::table('coupon_redemptions')
        ->where('id', $redemption->id)
        ->update(['created_at' => now()->subMonth()->startOfMonth()->addDays(14)]);

    // Redemption this month (should be excluded)
    $thisMonthOrder = analyticsOrder($buyer, $org, [
        'coupon_id'    => $coupon->id,
        'completed_at' => now(),
    ]);
    $buyer2 = User::factory()->create();
    analyticsRedemption($coupon, $thisMonthOrder, $buyer2, $org);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics?period=last_month");

    $response->assertOk()
        ->assertJsonPath('data.period', 'last_month')
        ->assertJsonPath('data.total_redemptions', 1);
});

it('returns all redemptions for period=all_time', function () {
    [$org, $user] = analyticsOrg('owner');
    $coupon = analyticsCoupon($org, $user);

    $buyer = User::factory()->create();

    // Old redemption (3 years ago)
    $oldOrder = analyticsOrder($buyer, $org, ['coupon_id' => $coupon->id]);
    $oldRedemption = analyticsRedemption($coupon, $oldOrder, $buyer, $org);
    DB::table('coupon_redemptions')
        ->where('id', $oldRedemption->id)
        ->update(['created_at' => now()->subYears(3)]);

    // Recent redemption
    $buyer2 = User::factory()->create();
    $newOrder = analyticsOrder($buyer2, $org, ['coupon_id' => $coupon->id]);
    analyticsRedemption($coupon, $newOrder, $buyer2, $org);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics?period=all_time");

    $response->assertOk()
        ->assertJsonPath('data.period', 'all_time')
        ->assertJsonPath('data.total_redemptions', 2);
});

it('returns 200 for staff role', function () {
    [$org, $user] = analyticsOrg('staff');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics")
        ->assertOk();
});

it('returns 403 for a participant with no org role', function () {
    [$org, $owner] = analyticsOrg('owner');

    $participant = User::factory()->create();

    $this->actingAs($participant)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics")
        ->assertForbidden();
});

it('returns 403 for billing_admin role', function () {
    [$org, $user] = analyticsOrg('billing_admin');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics")
        ->assertForbidden();
});

it('returns 403 when a user from org B requests org A analytics', function () {
    [$orgA, $ownerA] = analyticsOrg('owner');
    [$orgB, $ownerB] = analyticsOrg('owner');

    $this->actingAs($ownerB)
        ->getJson("/api/v1/organizations/{$orgA->id}/coupons/analytics")
        ->assertForbidden();
});

it('returns zeros and no errors when there are no redemptions in the period', function () {
    [$org, $user] = analyticsOrg('owner');

    $response = $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/coupons/analytics");

    $response->assertOk()
        ->assertJsonPath('data.total_redemptions', 0)
        ->assertJsonPath('data.total_discount_cents', 0)
        ->assertJsonPath('data.conversion_rate_pct', 0)
        ->assertJsonPath('data.orders_with_coupon', 0)
        ->assertJsonPath('data.total_orders', 0)
        ->assertJsonPath('data.top_coupon', null)
        ->assertJsonCount(0, 'data.per_coupon');
});
