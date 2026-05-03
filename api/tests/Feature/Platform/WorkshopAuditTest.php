<?php

use App\Models\AdminUser;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function auditAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Audit',
        'last_name'     => "Admin{$seq}",
        'email'         => "audit{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function auditToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

function makeWorkshopWithPricing(Organization $org, int $basePriceCents = 4900): Workshop
{
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    DB::table('workshop_pricing')->insert([
        'workshop_id'       => $workshop->id,
        'base_price_cents'  => $basePriceCents,
        'currency'          => 'usd',
        'is_paid'           => $basePriceCents > 0,
        'deposit_enabled'   => false,
        'created_at'        => now(),
        'updated_at'        => now(),
    ]);
    return $workshop;
}

function makeWorkshopNoPricing(Organization $org): Workshop
{
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    DB::table('workshop_pricing')->insert([
        'workshop_id'      => $workshop->id,
        'base_price_cents' => 0,
        'currency'         => 'usd',
        'is_paid'          => false,
        'deposit_enabled'  => false,
        'created_at'       => now(),
        'updated_at'       => now(),
    ]);
    return $workshop;
}

function makeReadyWorkshop(Organization $org): Workshop
{
    $workshop = Workshop::factory()->forOrganization($org->id)->create([
        'title'               => 'Landscape Photography Masterclass',
        'description'         => str_repeat('This is a great workshop for all photographers. ', 5),
        'status'              => 'draft',
        'timezone'            => 'America/New_York',
        'start_date'          => now()->addMonth()->format('Y-m-d'),
        'end_date'            => now()->addMonth()->addDays(3)->format('Y-m-d'),
        'public_page_enabled' => true,
    ]);

    // Virtual session with meeting_url (covers location component + virtual URL component)
    Session::factory()->forWorkshop($workshop->id)->create([
        'delivery_type' => 'virtual',
        'meeting_url'   => 'https://zoom.us/j/12345',
    ]);

    // Add a confirmed leader via workshop_leaders
    $leader = Leader::factory()->create();
    WorkshopLeader::create([
        'workshop_id'  => $workshop->id,
        'leader_id'    => $leader->id,
        'is_confirmed' => true,
    ]);

    // Add logistics
    DB::table('workshop_logistics')->insert([
        'workshop_id'         => $workshop->id,
        'hotel_name'          => 'The Grand Hotel',
        'meetup_instructions' => null,
        'created_at'          => now(),
        'updated_at'          => now(),
    ]);

    return $workshop;
}

// ─── GET /workshops/pricing-audit ─────────────────────────────────────────────

test('GET /workshops/pricing-audit returns 200 with correct shape', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    makeWorkshopWithPricing($org, 4900);

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/pricing-audit')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [[
                'workshop_id', 'title', 'organization_id', 'organization_name', 'status',
                'pricing' => [
                    'has_pricing', 'base_price_cents', 'currency',
                    'deposit_enabled', 'deposit_amount_cents',
                    'active_tier_count', 'session_pricing_count',
                ],
            ]],
            'total', 'per_page',
        ]);
});

test('GET /workshops/pricing-audit returns all workshops when no filter applied', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    makeWorkshopWithPricing($org, 4900);
    makeWorkshopNoPricing($org);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/pricing-audit')
        ->assertStatus(200);

    expect($response->json('total'))->toBe(2);
});

test('GET /workshops/pricing-audit?has_pricing=true filters to paid workshops only', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    makeWorkshopWithPricing($org, 4900);
    makeWorkshopWithPricing($org, 9900);
    makeWorkshopNoPricing($org);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/pricing-audit?has_pricing=true')
        ->assertStatus(200);

    expect($response->json('total'))->toBe(2);
    expect($response->json('data.0.pricing.has_pricing'))->toBeTrue();
});

test('GET /workshops/pricing-audit?has_pricing=false filters to unpaid workshops only', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    makeWorkshopWithPricing($org, 4900);
    makeWorkshopNoPricing($org);
    makeWorkshopNoPricing($org);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/pricing-audit?has_pricing=false')
        ->assertStatus(200);

    expect($response->json('total'))->toBe(2);
    expect($response->json('data.0.pricing.has_pricing'))->toBeFalse();
});

test('GET /workshops/pricing-audit?organization_id={id} filters to one org', function () {
    $admin = auditAdmin();
    $org1  = Organization::factory()->create();
    $org2  = Organization::factory()->create();
    makeWorkshopWithPricing($org1, 4900);
    makeWorkshopWithPricing($org1, 4900);
    makeWorkshopWithPricing($org2, 4900);

    $response = $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/workshops/pricing-audit?organization_id={$org1->id}")
        ->assertStatus(200);

    expect($response->json('total'))->toBe(2)
        ->and($response->json('data.0.organization_id'))->toBe($org1->id);
});

test('GET /workshops/pricing-audit pricing fields are correct', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    $workshop = makeWorkshopWithPricing($org, 9900);

    // Add a price tier
    DB::table('workshop_price_tiers')->insert([
        'workshop_id' => $workshop->id,
        'label'       => 'Early Bird',
        'price_cents' => 7900,
        'valid_from'  => now()->subDay(),
        'valid_until' => now()->addMonth(),
        'is_active'   => true,
        'created_at'  => now(),
        'updated_at'  => now(),
    ]);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/pricing-audit')
        ->assertStatus(200);

    $pricing = $response->json('data.0.pricing');
    expect($pricing['base_price_cents'])->toBe(9900)
        ->and($pricing['currency'])->toBe('usd')
        ->and($pricing['active_tier_count'])->toBe(1)
        ->and($pricing['has_pricing'])->toBeTrue();
});

// ─── GET /workshops/readiness ──────────────────────────────────────────────────

test('GET /workshops/readiness returns 200 with correct shape', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    Workshop::factory()->forOrganization($org->id)->create();

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/readiness')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [[
                'workshop_id', 'title', 'organization_id', 'organization_name',
                'status', 'readiness_score', 'missing_items', 'ready_to_publish',
            ]],
            'total', 'per_page', 'current_page', 'last_page',
        ]);
});

test('GET /workshops/readiness is ordered by readiness_score ASC', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();

    // Factory default: no sessions, no leaders, no location, no logistics → lower score
    Workshop::factory()->forOrganization($org->id)->create(['public_page_enabled' => false]);

    // Well-configured workshop with all components filled → higher score
    makeReadyWorkshop($org);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/readiness')
        ->assertStatus(200);

    $scores = collect($response->json('data'))->pluck('readiness_score');
    expect($scores->first())->toBeLessThanOrEqual($scores->last());
});

test('GET /workshops/readiness?min_score=80 returns only workshops scoring >= 80', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();

    // Low score workshop: factory default has no sessions, leaders, logistics
    Workshop::factory()->forOrganization($org->id)->create(['public_page_enabled' => false]);

    // High score workshop
    makeReadyWorkshop($org);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/readiness?min_score=80')
        ->assertStatus(200);

    foreach ($response->json('data') as $item) {
        expect($item['readiness_score'])->toBeGreaterThanOrEqual(80);
    }
});

test('GET /workshops/readiness ready_to_publish is true when score >= 80', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();
    makeReadyWorkshop($org);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/readiness?min_score=80')
        ->assertStatus(200);

    $data = $response->json('data');
    if (count($data) > 0) {
        foreach ($data as $item) {
            expect($item['ready_to_publish'])->toBeTrue();
        }
    }
});

test('GET /workshops/readiness missing_items lists what is absent', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();

    // Factory default workshop: no sessions, leaders, location, logistics, public page disabled → several missing items
    Workshop::factory()->forOrganization($org->id)->create(['public_page_enabled' => false]);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/workshops/readiness')
        ->assertStatus(200);

    $data = $response->json('data');
    expect(count($data))->toBeGreaterThan(0);
    expect($response->json('data.0.missing_items'))->not->toBeEmpty();
});

// ─── GET /financials/refund-policies ──────────────────────────────────────────

test('GET /financials/refund-policies returns 200 even when table has no data', function () {
    $admin = auditAdmin('billing');

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/financials/refund-policies')
        ->assertStatus(200)
        ->assertJsonStructure([
            'summary' => ['total', 'platform_level', 'org_level', 'workshop_level', 'workshops_without_policy'],
            'data',
        ]);
});

test('GET /financials/refund-policies returns correct summary shape', function () {
    $admin = auditAdmin('billing');
    $org   = Organization::factory()->create();

    DB::table('refund_policies')->insert([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'workshop_id'                => null,
        'full_refund_cutoff_days'    => 14,
        'partial_refund_cutoff_days' => 7,
        'partial_refund_pct'         => 50.00,
        'no_refund_cutoff_hours'     => 48,
        'wayfield_fee_refundable'    => false,
        'stripe_fee_refundable'      => false,
        'allow_credits'              => false,
        'created_at'                 => now(),
        'updated_at'                 => now(),
    ]);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/financials/refund-policies')
        ->assertStatus(200);

    expect($response->json('summary.total'))->toBe(1)
        ->and($response->json('summary.org_level'))->toBe(1)
        ->and($response->json('summary.platform_level'))->toBe(0);
});

test('GET /financials/refund-policies?policy_level=org filters by scope', function () {
    $admin = auditAdmin('billing');
    $org   = Organization::factory()->create();
    $w     = Workshop::factory()->forOrganization($org->id)->create();

    DB::table('refund_policies')->insert([
        [
            'scope'                      => 'organization',
            'organization_id'            => $org->id,
            'workshop_id'                => null,
            'full_refund_cutoff_days'    => 14,
            'partial_refund_cutoff_days' => 7,
            'partial_refund_pct'         => 50.00,
            'no_refund_cutoff_hours'     => 48,
            'wayfield_fee_refundable'    => false,
            'stripe_fee_refundable'      => false,
            'allow_credits'              => false,
            'created_at'                 => now(),
            'updated_at'                 => now(),
        ],
        [
            'scope'                      => 'workshop',
            'organization_id'            => null,
            'workshop_id'                => $w->id,
            'full_refund_cutoff_days'    => 7,
            'partial_refund_cutoff_days' => 3,
            'partial_refund_pct'         => 25.00,
            'no_refund_cutoff_hours'     => 24,
            'wayfield_fee_refundable'    => false,
            'stripe_fee_refundable'      => false,
            'allow_credits'              => false,
            'created_at'                 => now(),
            'updated_at'                 => now(),
        ],
    ]);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/financials/refund-policies?policy_level=org')
        ->assertStatus(200);

    foreach ($response->json('data.data') as $policy) {
        expect($policy['policy_level'])->toBe('organization');
    }
});

test('GET /financials/refund-policies response includes policy_level in data items', function () {
    $admin = auditAdmin('billing');
    $org   = Organization::factory()->create();

    DB::table('refund_policies')->insert([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'workshop_id'                => null,
        'full_refund_cutoff_days'    => 14,
        'partial_refund_cutoff_days' => 7,
        'partial_refund_pct'         => 50.00,
        'no_refund_cutoff_hours'     => 48,
        'wayfield_fee_refundable'    => false,
        'stripe_fee_refundable'      => false,
        'allow_credits'              => false,
        'created_at'                 => now(),
        'updated_at'                 => now(),
    ]);

    $response = $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/financials/refund-policies')
        ->assertStatus(200);

    $first = $response->json('data.data.0');
    expect($first)->toHaveKey('policy_level')
        ->and($first)->toHaveKey('is_active')
        ->and($first)->toHaveKey('organization_name');
});

// ─── GET /organizations/{id}/leader-completion ────────────────────────────────

test('GET /organizations/{id}/leader-completion returns 200 with correct shape', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();

    $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/leader-completion")
        ->assertStatus(200)
        ->assertJsonStructure([
            'organization_id', 'organization_name',
            'total_leaders', 'completed_profiles', 'incomplete_profiles',
            'completion_rate_pct',
            'leaders',
        ]);
});

test('GET /organizations/{id}/leader-completion returns empty leaders for org with none', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();

    $response = $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/leader-completion")
        ->assertStatus(200);

    expect($response->json('total_leaders'))->toBe(0)
        ->and($response->json('completion_rate_pct'))->toEqual(0)
        ->and($response->json('leaders'))->toBeEmpty();
});

test('GET /organizations/{id}/leader-completion marks leader complete when all fields filled', function () {
    $admin  = auditAdmin();
    $org    = Organization::factory()->create();
    $leader = Leader::factory()->create([
        'bio'               => str_repeat('Experienced photographer. ', 5),
        'profile_image_url' => 'https://example.com/photo.jpg',
        'website_url'       => 'https://example.com',
    ]);

    // Link leader to org
    DB::table('organization_leaders')->insert([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    // Create accepted invitation
    LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop(Workshop::factory()->forOrganization($org->id)->create()->id)
        ->accepted()
        ->create([
            'leader_id'     => $leader->id,
            'invited_email' => $leader->email ?? 'leader@example.com',
        ]);

    $response = $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/leader-completion")
        ->assertStatus(200);

    expect($response->json('total_leaders'))->toBe(1)
        ->and($response->json('completed_profiles'))->toBe(1)
        ->and($response->json('leaders.0.profile_complete'))->toBeTrue();
});

test('GET /organizations/{id}/leader-completion marks incomplete when bio is missing', function () {
    $admin  = auditAdmin();
    $org    = Organization::factory()->create();
    $leader = Leader::factory()->create([
        'bio'               => null,
        'profile_image_url' => 'https://example.com/photo.jpg',
        'website_url'       => 'https://example.com',
    ]);

    DB::table('organization_leaders')->insert([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'created_at'      => now(),
        'updated_at'      => now(),
    ]);

    LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop(Workshop::factory()->forOrganization($org->id)->create()->id)
        ->accepted()
        ->create([
            'leader_id'     => $leader->id,
            'invited_email' => $leader->email ?? 'leader2@example.com',
        ]);

    $response = $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}/leader-completion")
        ->assertStatus(200);

    expect($response->json('leaders.0.profile_complete'))->toBeFalse()
        ->and($response->json('leaders.0.missing_fields'))->toContain('bio missing or too short');
});

test('GET /organizations/{id}/leader-completion returns 404 for unknown org', function () {
    $admin = auditAdmin();

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/organizations/99999/leader-completion')
        ->assertStatus(404);
});

// ─── GET /organizations/{id} includes leader_completion summary ───────────────

test('GET /organizations/{id} includes leader_completion summary', function () {
    $admin = auditAdmin();
    $org   = Organization::factory()->create();

    $this->withToken(auditToken($admin))
        ->getJson("/api/platform/v1/organizations/{$org->id}")
        ->assertStatus(200)
        ->assertJsonStructure([
            'id', 'name',
            'leader_completion' => ['total', 'complete', 'completion_rate_pct'],
        ]);
});

// ─── Auth isolation: all new routes reject tenant token ───────────────────────

test('GET /workshops/pricing-audit is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/workshops/pricing-audit')
        ->assertStatus(401);
});

test('GET /workshops/readiness is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/workshops/readiness')
        ->assertStatus(401);
});

test('GET /financials/refund-policies is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/financials/refund-policies')
        ->assertStatus(401);
});

test('GET /organizations/{id}/leader-completion is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;
    $org   = Organization::factory()->create();

    $this->withToken($token)
        ->getJson("/api/platform/v1/organizations/{$org->id}/leader-completion")
        ->assertStatus(401);
});

test('GET /workshops/pricing-audit requires authentication', function () {
    $this->getJson('/api/platform/v1/workshops/pricing-audit')->assertStatus(401);
});

test('GET /workshops/readiness requires authentication', function () {
    $this->getJson('/api/platform/v1/workshops/readiness')->assertStatus(401);
});

test('GET /financials/refund-policies is rejected for support role', function () {
    $admin = auditAdmin('support');

    $this->withToken(auditToken($admin))
        ->getJson('/api/platform/v1/financials/refund-policies')
        ->assertStatus(403);
});
