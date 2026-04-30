<?php

use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ptoOrg(string $planCode = 'starter', string $role = 'owner'): array
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

function ptoWorkshop(Organization $org): Workshop
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

function ptoTier(Workshop $workshop, array $overrides = []): WorkshopPriceTier
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

// ─── Plan gating ─────────────────────────────────────────────────────────────

test('pto: Foundation plan returns 402 on tier index', function () {
    [$org, $user] = ptoOrg('free');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers")
        ->assertStatus(402);
});

test('pto: Creator (starter) plan can list tiers', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers")
        ->assertOk();
});

test('pto: Studio (pro) plan can list tiers', function () {
    [$org, $user] = ptoOrg('pro');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers")
        ->assertOk();
});

// ─── Role gating ─────────────────────────────────────────────────────────────

test('pto: staff member cannot create tiers (403)', function () {
    [$org, $user] = ptoOrg('starter', 'staff');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Early Bird',
        'price_cents' => 30000,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertForbidden();
});

test('pto: owner can create a tier and receives 201', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Early Bird',
        'price_cents' => 30000,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertStatus(201)
      ->assertJsonPath('data.label', 'Early Bird')
      ->assertJsonPath('data.price_cents', 30000);

    expect(WorkshopPriceTier::where('workshop_id', $workshop->id)->count())->toBe(1);
});

// ─── POST validation ──────────────────────────────────────────────────────────

test('pto: POST fails when price_cents exceeds base_price_cents', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Premium',
        'price_cents' => 99999,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['price_cents']);
});

test('pto: POST fails when price_cents is 0', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Free',
        'price_cents' => 0,
        'valid_until' => now()->addDays(7)->toIso8601String(),
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['price_cents']);
});

test('pto: POST fails when neither valid_until nor capacity_limit provided', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Eternal',
        'price_cents' => 30000,
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['valid_until']);
});

test('pto: POST fails when valid_until is after workshop start_date', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org); // start_date = +3 months

    $this->actingAs($user)->postJson("/api/v1/workshops/{$workshop->id}/price-tiers", [
        'label'       => 'Late',
        'price_cents' => 30000,
        'valid_until' => now()->addYear()->toIso8601String(),
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['valid_until']);
});

// ─── PATCH ───────────────────────────────────────────────────────────────────

test('pto: PATCH updates label successfully', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    $tier     = ptoTier($workshop);

    $this->actingAs($user)->patchJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}", [
        'label' => 'Super Early',
    ])->assertOk()
      ->assertJsonPath('data.label', 'Super Early');
});

test('pto: PATCH updates valid_until successfully', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    $tier     = ptoTier($workshop);

    $this->actingAs($user)->patchJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}", [
        'valid_until' => now()->addDays(14)->toIso8601String(),
    ])->assertOk();

    expect($tier->fresh()->valid_until)->not->toBeNull();
});

test('pto: PATCH cannot change price_cents once tier has been used', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    $tier     = ptoTier($workshop);

    DB::table('workshop_price_tiers')
        ->where('id', $tier->id)
        ->update(['registrations_at_tier' => 3]);

    $this->actingAs($user)->patchJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}", [
        'price_cents' => 20000,
    ])->assertStatus(422)
      ->assertJsonValidationErrors(['price_cents']);
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

test('pto: DELETE soft-deactivates the tier', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    $tier     = ptoTier($workshop);

    $this->actingAs($user)->deleteJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}")
        ->assertOk()
        ->assertJsonFragment(['message' => 'Tier deactivated.']);

    expect($tier->fresh()->is_active)->toBeFalse();
});

test('pto: DELETE active tier produces an audit log entry', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    $tier     = ptoTier($workshop); // currently active

    $this->actingAs($user)->deleteJson("/api/v1/workshops/{$workshop->id}/price-tiers/{$tier->id}")
        ->assertOk();

    $auditEntry = DB::table('audit_logs')
        ->where('action', 'price_tier.deactivated_while_active')
        ->where('entity_id', $tier->id)
        ->first();

    expect($auditEntry)->not->toBeNull();
});

// ─── PUT order ────────────────────────────────────────────────────────────────

test('pto: PUT order reorders tiers', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);

    $tier1 = ptoTier($workshop, ['sort_order' => 0, 'label' => 'First']);
    $tier2 = ptoTier($workshop, ['sort_order' => 1, 'label' => 'Second']);

    $this->actingAs($user)->putJson("/api/v1/workshops/{$workshop->id}/price-tiers/order", [
        'tiers' => [
            ['id' => $tier1->id, 'sort_order' => 1],
            ['id' => $tier2->id, 'sort_order' => 0],
        ],
    ])->assertOk();

    expect($tier1->fresh()->sort_order)->toBe(1);
    expect($tier2->fresh()->sort_order)->toBe(0);
});

test('pto: PUT order rejects tier IDs belonging to a different workshop', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop1    = ptoWorkshop($org);
    $workshop2    = ptoWorkshop($org);

    $tier1 = ptoTier($workshop1);
    $tier2 = ptoTier($workshop2); // wrong workshop

    $this->actingAs($user)->putJson("/api/v1/workshops/{$workshop1->id}/price-tiers/order", [
        'tiers' => [
            ['id' => $tier1->id, 'sort_order' => 0],
            ['id' => $tier2->id, 'sort_order' => 1],
        ],
    ])->assertStatus(422);
});

// ─── GET index ────────────────────────────────────────────────────────────────

test('pto: GET index response includes is_currently_active for each tier', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    ptoTier($workshop);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers")
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'label', 'price_cents', 'is_currently_active']]]);
});

// ─── GET current ─────────────────────────────────────────────────────────────

test('pto: GET current returns public pricing for unauthenticated request', function () {
    [$org] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    ptoTier($workshop, ['price_cents' => 30000]);

    $this->getJson("/api/v1/workshops/{$workshop->id}/price-tiers/current")
        ->assertOk()
        ->assertJsonStructure(['pricing' => ['current_price_cents', 'base_price_cents', 'is_tier_price']]);
});

test('pto: GET current returns organizer view for authenticated owner', function () {
    [$org, $user] = ptoOrg('starter');
    $workshop = ptoWorkshop($org);
    ptoTier($workshop, ['price_cents' => 30000]);

    $this->actingAs($user)->getJson("/api/v1/workshops/{$workshop->id}/price-tiers/current")
        ->assertOk()
        ->assertJsonStructure([
            'pricing_display',
            'current_resolution',
            'registration_count',
            'tiers',
        ]);
});
