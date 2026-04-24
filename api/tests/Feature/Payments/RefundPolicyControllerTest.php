<?php

use App\Domain\Payments\Models\RefundPolicy;
use App\Domain\Payments\Services\RefundPolicyResolutionService;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function refundPolicyOrg(string $role = 'owner'): array
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

function validPolicyPayload(array $overrides = []): array
{
    return array_merge([
        'scope'                      => 'organization',
        'full_refund_cutoff_days'    => 30,
        'partial_refund_cutoff_days' => 14,
        'partial_refund_pct'         => 50,
        'no_refund_cutoff_hours'     => 48,
    ], $overrides);
}

// ─── GET /organizations/{organization}/refund-policy ─────────────────────────

it('returns null when no org refund policy exists', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/refund-policy")
        ->assertOk()
        ->assertJson(['data' => null]);
});

it('returns existing org refund policy', function () {
    [$org, $user] = refundPolicyOrg('owner');

    RefundPolicy::create([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'full_refund_cutoff_days'    => 30,
        'partial_refund_cutoff_days' => 14,
        'partial_refund_pct'         => 50,
        'no_refund_cutoff_hours'     => 48,
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/refund-policy")
        ->assertOk()
        ->assertJsonPath('data.full_refund_cutoff_days', 30);
});

it('denies staff from viewing org refund policy', function () {
    [$org, $user] = refundPolicyOrg('staff');

    $this->actingAs($user)
        ->getJson("/api/v1/organizations/{$org->id}/refund-policy")
        ->assertForbidden();
});

// ─── POST /organizations/{organization}/refund-policy ────────────────────────

it('creates an org refund policy for owner', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", validPolicyPayload())
        ->assertCreated()
        ->assertJsonPath('data.full_refund_cutoff_days', 30)
        ->assertJsonPath('data.scope', 'organization');

    $this->assertDatabaseHas('refund_policies', [
        'organization_id'         => $org->id,
        'scope'                   => 'organization',
        'full_refund_cutoff_days' => 30,
    ]);
});

it('creates an org refund policy for admin', function () {
    [$org, $user] = refundPolicyOrg('admin');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", validPolicyPayload())
        ->assertCreated();
});

it('returns 409 when org refund policy already exists', function () {
    [$org, $user] = refundPolicyOrg('owner');

    RefundPolicy::create([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'full_refund_cutoff_days'    => 30,
        'partial_refund_cutoff_days' => 14,
        'partial_refund_pct'         => 50,
        'no_refund_cutoff_hours'     => 48,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", validPolicyPayload())
        ->assertStatus(409);
});

it('validates partial_refund_cutoff_days <= full_refund_cutoff_days', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $payload = validPolicyPayload(['partial_refund_cutoff_days' => 45, 'full_refund_cutoff_days' => 30]);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['partial_refund_cutoff_days']);
});

it('validates required fields for refund policy', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors([
            'scope',
            'full_refund_cutoff_days',
            'partial_refund_cutoff_days',
            'partial_refund_pct',
            'no_refund_cutoff_hours',
        ]);
});

it('accepts credit fields when allow_credits is true', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $payload = validPolicyPayload([
        'allow_credits'      => true,
        'credit_expiry_days' => 365,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", $payload)
        ->assertCreated()
        ->assertJsonPath('data.allow_credits', true)
        ->assertJsonPath('data.credit_expiry_days', 365);
});

it('denies staff from creating org refund policy', function () {
    [$org, $user] = refundPolicyOrg('staff');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/refund-policy", validPolicyPayload())
        ->assertForbidden();
});

// ─── PUT /organizations/{organization}/refund-policy ─────────────────────────

it('updates org refund policy', function () {
    [$org, $user] = refundPolicyOrg('owner');

    RefundPolicy::create([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'full_refund_cutoff_days'    => 30,
        'partial_refund_cutoff_days' => 14,
        'partial_refund_pct'         => 50,
        'no_refund_cutoff_hours'     => 48,
    ]);

    $this->actingAs($user)
        ->putJson(
            "/api/v1/organizations/{$org->id}/refund-policy",
            validPolicyPayload(['full_refund_cutoff_days' => 60]),
        )
        ->assertOk()
        ->assertJsonPath('data.full_refund_cutoff_days', 60);
});

it('returns 404 on PUT org policy when none exists', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $this->actingAs($user)
        ->putJson("/api/v1/organizations/{$org->id}/refund-policy", validPolicyPayload())
        ->assertNotFound();
});

// ─── Workshop-level refund policy ────────────────────────────────────────────

it('creates a workshop-level refund policy', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $payload = validPolicyPayload(['scope' => 'workshop']);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/refund-policy", $payload)
        ->assertCreated()
        ->assertJsonPath('data.scope', 'workshop')
        ->assertJsonPath('data.workshop_id', $workshop->id);
});

it('returns existing workshop refund policy', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    RefundPolicy::create([
        'scope'                      => 'workshop',
        'organization_id'            => $org->id,
        'workshop_id'                => $workshop->id,
        'full_refund_cutoff_days'    => 21,
        'partial_refund_cutoff_days' => 7,
        'partial_refund_pct'         => 75,
        'no_refund_cutoff_hours'     => 24,
    ]);

    $this->actingAs($user)
        ->getJson("/api/v1/workshops/{$workshop->id}/refund-policy")
        ->assertOk()
        ->assertJsonPath('data.full_refund_cutoff_days', 21);
});

it('updates workshop refund policy', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    RefundPolicy::create([
        'scope'                      => 'workshop',
        'organization_id'            => $org->id,
        'workshop_id'                => $workshop->id,
        'full_refund_cutoff_days'    => 21,
        'partial_refund_cutoff_days' => 7,
        'partial_refund_pct'         => 75,
        'no_refund_cutoff_hours'     => 24,
    ]);

    $this->actingAs($user)
        ->putJson(
            "/api/v1/workshops/{$workshop->id}/refund-policy",
            validPolicyPayload(['scope' => 'workshop', 'full_refund_cutoff_days' => 45]),
        )
        ->assertOk()
        ->assertJsonPath('data.full_refund_cutoff_days', 45);
});

it('returns 409 when workshop refund policy already exists on POST', function () {
    [$org, $user] = refundPolicyOrg('owner');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    RefundPolicy::create([
        'scope'                      => 'workshop',
        'organization_id'            => $org->id,
        'workshop_id'                => $workshop->id,
        'full_refund_cutoff_days'    => 21,
        'partial_refund_cutoff_days' => 7,
        'partial_refund_pct'         => 75,
        'no_refund_cutoff_hours'     => 24,
    ]);

    $this->actingAs($user)
        ->postJson("/api/v1/workshops/{$workshop->id}/refund-policy", validPolicyPayload(['scope' => 'workshop']))
        ->assertStatus(409);
});

// ─── RefundPolicyResolutionService ───────────────────────────────────────────

it('resolves workshop-level policy first', function () {
    [$org, ] = refundPolicyOrg('owner');
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    RefundPolicy::create([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'full_refund_cutoff_days'    => 30,
        'partial_refund_cutoff_days' => 14,
        'partial_refund_pct'         => 50,
        'no_refund_cutoff_hours'     => 48,
    ]);

    $workshopPolicy = RefundPolicy::create([
        'scope'                      => 'workshop',
        'organization_id'            => $org->id,
        'workshop_id'                => $workshop->id,
        'full_refund_cutoff_days'    => 7,
        'partial_refund_cutoff_days' => 3,
        'partial_refund_pct'         => 25,
        'no_refund_cutoff_hours'     => 12,
    ]);

    $service  = app(RefundPolicyResolutionService::class);
    $resolved = $service->resolve($workshop);

    expect($resolved->id)->toBe($workshopPolicy->id)
        ->and($resolved->full_refund_cutoff_days)->toBe(7);
});

it('falls back to org-level policy when no workshop policy', function () {
    [$org, ] = refundPolicyOrg('owner');
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $orgPolicy = RefundPolicy::create([
        'scope'                      => 'organization',
        'organization_id'            => $org->id,
        'full_refund_cutoff_days'    => 30,
        'partial_refund_cutoff_days' => 14,
        'partial_refund_pct'         => 50,
        'no_refund_cutoff_hours'     => 48,
    ]);

    $service  = app(RefundPolicyResolutionService::class);
    $resolved = $service->resolve($workshop);

    expect($resolved->id)->toBe($orgPolicy->id)
        ->and($resolved->full_refund_cutoff_days)->toBe(30);
});

it('returns platform default when no policy exists', function () {
    [$org, ] = refundPolicyOrg('owner');
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $service  = app(RefundPolicyResolutionService::class);
    $resolved = $service->resolve($workshop);

    // Platform defaults
    expect($resolved->full_refund_cutoff_days)->toBe(30)
        ->and($resolved->partial_refund_pct)->toBe(50.0)
        ->and($resolved->id)->toBeNull(); // not persisted
});

// ─── Cross-tenant isolation ───────────────────────────────────────────────────

it('rejects a user from a different org accessing org refund policy', function () {
    [$org,  ] = refundPolicyOrg('owner');
    [$org2, $user2] = refundPolicyOrg('owner');

    $this->actingAs($user2)
        ->getJson("/api/v1/organizations/{$org->id}/refund-policy")
        ->assertForbidden();
});
