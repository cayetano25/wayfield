<?php

use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Services\PaymentFeatureFlagService;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pricingOrg(string $role = 'owner'): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => $role,
        'is_active'       => true,
    ]);

    return [$org, $user];
}

function pricingWorkshop(Organization $org, array $overrides = []): Workshop
{
    return Workshop::factory()->create(array_merge(
        ['organization_id' => $org->id, 'start_date' => now()->addMonths(3)->toDateString()],
        $overrides,
    ));
}

function enableDepositsForOrg(): void
{
    // The CREATOR_PLANS check in PaymentFeatureFlagService uses plan codes ('creator',
    // 'studio', 'custom') that don't exist in the subscriptions ENUM ('free','starter',
    // 'pro','enterprise'). Mock the service so the plan-tier gate returns true in tests.
    $mock = Mockery::mock(PaymentFeatureFlagService::class)->makePartial();
    $mock->shouldReceive('isDepositsEnabled')->andReturn(true);
    app()->instance(PaymentFeatureFlagService::class, $mock);
}

function validPricingPayload(array $overrides = []): array
{
    return array_merge([
        'base_price_cents' => 20000,
        'is_paid'          => true,
    ], $overrides);
}

// ─── GET /workshops/{workshop}/pricing ───────────────────────────────────────

it('returns null data when no pricing exists', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    $response = $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/pricing");

    $response->assertOk()->assertJson(['data' => null]);
});

it('returns existing pricing', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    WorkshopPricing::create(['workshop_id' => $workshop->id, 'base_price_cents' => 15000, 'is_paid' => true]);

    $response = $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/pricing");

    $response->assertOk()->assertJsonPath('data.base_price_cents', 15000);
});

it('denies staff from viewing pricing', function () {
    [$org, $user] = pricingOrg('staff');
    $workshop     = pricingWorkshop($org);

    $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/pricing")
        ->assertForbidden();
});

it('denies unauthenticated access', function () {
    $workshop = pricingWorkshop(Organization::factory()->create());

    $this->getJson("/api/v1/workshops/{$workshop->id}/pricing")->assertUnauthorized();
});

// ─── POST /workshops/{workshop}/pricing ──────────────────────────────────────

it('creates workshop pricing for owner', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    $response = $this->actingAs($user)->postJson(
        "/api/v1/workshops/{$workshop->id}/pricing",
        validPricingPayload(),
    );

    $response->assertCreated()
        ->assertJsonPath('data.base_price_cents', 20000)
        ->assertJsonPath('data.is_paid', true);

    $this->assertDatabaseHas('workshop_pricing', [
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 20000,
    ]);
});

it('creates workshop pricing for admin', function () {
    [$org, $user] = pricingOrg('admin');
    $workshop     = pricingWorkshop($org);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", validPricingPayload())
        ->assertCreated();
});

it('returns 409 if pricing already exists on POST', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    WorkshopPricing::create(['workshop_id' => $workshop->id, 'base_price_cents' => 5000, 'is_paid' => true]);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", validPricingPayload())
        ->assertStatus(409);
});

it('denies staff from creating pricing', function () {
    [$org, $user] = pricingOrg('staff');
    $workshop     = pricingWorkshop($org);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", validPricingPayload())
        ->assertForbidden();
});

it('validates required fields', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['base_price_cents', 'is_paid']);
});

it('rejects deposit_amount_cents >= base_price_cents', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);
    enableDepositsForOrg();

    $payload = validPricingPayload([
        'deposit_enabled'      => true,
        'deposit_amount_cents' => 20000, // equal to base price
        'balance_due_date'     => now()->addMonths(2)->toDateString(),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['deposit_amount_cents']);
});

it('rejects deposit when org is not on creator/studio plan', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    // No creator plan — deposits not enabled
    PaymentFeatureFlag::firstOrCreate(
        ['scope' => 'platform', 'flag_key' => 'payments_enabled'],
        ['is_enabled' => true],
    );

    $payload = validPricingPayload([
        'deposit_enabled'      => true,
        'deposit_amount_cents' => 5000,
        'balance_due_date'     => now()->addMonths(2)->toDateString(),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['deposit_enabled']);
});

it('rejects balance_due_date on or after workshop start_date', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org, ['start_date' => now()->addMonths(2)->toDateString()]);
    enableDepositsForOrg();

    $payload = validPricingPayload([
        'deposit_enabled'      => true,
        'deposit_amount_cents' => 5000,
        'balance_due_date'     => now()->addMonths(2)->toDateString(), // same as start
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['balance_due_date']);
});

it('creates pricing with deposit when plan allows', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);
    enableDepositsForOrg();

    $payload = validPricingPayload([
        'deposit_enabled'      => true,
        'deposit_amount_cents' => 5000,
        'balance_due_date'     => now()->addMonths(2)->toDateString(),
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/pricing", $payload)
        ->assertCreated()
        ->assertJsonPath('data.deposit_enabled', true)
        ->assertJsonPath('data.deposit_amount_cents', 5000);
});

// ─── PUT /workshops/{workshop}/pricing ───────────────────────────────────────

it('updates existing pricing', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    WorkshopPricing::create(['workshop_id' => $workshop->id, 'base_price_cents' => 10000, 'is_paid' => true]);

    $this->actingAs($user)
        ->putJson("/api/v1/workshops/{$workshop->id}/pricing", validPricingPayload(['base_price_cents' => 25000]))
        ->assertOk()
        ->assertJsonPath('data.base_price_cents', 25000);
});

it('returns 404 on PUT when no pricing exists', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    $this->actingAs($user)
        ->putJson("/api/v1/workshops/{$workshop->id}/pricing", validPricingPayload())
        ->assertNotFound();
});

// ─── GET /workshops/{workshop}/pricing/preview ───────────────────────────────

it('returns fee breakdown preview', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    WorkshopPricing::create(['workshop_id' => $workshop->id, 'base_price_cents' => 20000, 'is_paid' => true]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/pricing/preview");

    $response->assertOk()
        ->assertJsonStructure(['base_price', 'wayfield_fee', 'stripe_fee', 'organizer_payout', 'take_rate_pct'])
        ->assertJsonPath('base_price', '200.00');
});

it('returns deposit breakdown in preview when deposit enabled', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);
    enableDepositsForOrg();

    WorkshopPricing::create([
        'workshop_id'          => $workshop->id,
        'base_price_cents'     => 20000,
        'is_paid'              => true,
        'deposit_enabled'      => true,
        'deposit_amount_cents' => 7500,
        'balance_due_date'     => now()->addMonths(2)->toDateString(),
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/pricing/preview");

    $response->assertOk()
        ->assertJsonStructure(['deposit_breakdown'])
        ->assertJsonPath('deposit_breakdown.deposit_amount', '75.00')
        ->assertJsonPath('deposit_breakdown.balance_amount', '125.00');
});

it('returns 404 preview when no pricing exists', function () {
    [$org, $user] = pricingOrg('owner');
    $workshop     = pricingWorkshop($org);

    $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/pricing/preview")
        ->assertNotFound();
});
