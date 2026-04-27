<?php

use App\Domain\Payments\Models\SessionPricing;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionPricingContext(string $role = 'owner', string $sessionType = 'addon'): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => $role,
        'is_active'       => true,
    ]);

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session  = Session::factory()->create([
        'workshop_id'  => $workshop->id,
        'session_type' => $sessionType,
    ]);

    return [$org, $user, $workshop, $session];
}

// ─── GET /sessions/{session}/pricing ─────────────────────────────────────────

it('returns null data when no session pricing exists', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->getJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertOk()
        ->assertJson(['data' => null]);
});

it('returns existing session pricing', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    SessionPricing::create(['session_id' => $session->id, 'price_cents' => 5000]);

    $this->actingAs($user)
        ->getJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertOk()
        ->assertJsonPath('data.price_cents', 5000);
});

it('denies staff from viewing session pricing', function () {
    [, $user, , $session] = sessionPricingContext('staff', 'addon');

    $this->actingAs($user)
        ->getJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertForbidden();
});

// ─── POST /sessions/{session}/pricing ────────────────────────────────────────

it('creates session pricing for addon session', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", [
            'price_cents'      => 9900,
            'is_nonrefundable' => true,
        ])
        ->assertCreated()
        ->assertJsonPath('data.price_cents', 9900)
        ->assertJsonPath('data.is_nonrefundable', true);

    $this->assertDatabaseHas('session_pricing', [
        'session_id'  => $session->id,
        'price_cents' => 9900,
    ]);
});

it('rejects pricing on standard sessions', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'standard');

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => 9900])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['session']);
});

it('returns 409 if session pricing already exists on POST', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    SessionPricing::create(['session_id' => $session->id, 'price_cents' => 5000]);

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => 9900])
        ->assertStatus(409);
});

it('validates required price_cents field', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['price_cents']);
});

it('accepts price_cents of zero for free addon sessions', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => 0])
        ->assertCreated()
        ->assertJsonPath('data.price_cents', 0);
});

it('rejects negative price_cents', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => -100])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['price_cents']);
});

it('denies staff from creating session pricing', function () {
    [, $user, , $session] = sessionPricingContext('staff', 'addon');

    $this->actingAs($user)
        ->postJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => 9900])
        ->assertForbidden();
});

// ─── PUT /sessions/{session}/pricing ─────────────────────────────────────────

it('updates session pricing', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    SessionPricing::create(['session_id' => $session->id, 'price_cents' => 5000]);

    $this->actingAs($user)
        ->putJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => 12000])
        ->assertOk()
        ->assertJsonPath('data.price_cents', 12000);
});

it('returns 404 on PUT when no session pricing exists', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->putJson("/api/v1/sessions/{$session->id}/pricing", ['price_cents' => 12000])
        ->assertNotFound();
});

// ─── DELETE /sessions/{session}/pricing ──────────────────────────────────────

it('deletes session pricing', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    SessionPricing::create(['session_id' => $session->id, 'price_cents' => 5000]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertNoContent();

    $this->assertDatabaseMissing('session_pricing', ['session_id' => $session->id]);
});

it('returns 404 on DELETE when no session pricing exists', function () {
    [, $user, , $session] = sessionPricingContext('owner', 'addon');

    $this->actingAs($user)
        ->deleteJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertNotFound();
});

it('denies staff from deleting session pricing', function () {
    [, $user, , $session] = sessionPricingContext('staff', 'addon');

    SessionPricing::create(['session_id' => $session->id, 'price_cents' => 5000]);

    $this->actingAs($user)
        ->deleteJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertForbidden();
});

// ─── Cross-tenant isolation ───────────────────────────────────────────────────

it('rejects access from a user of a different organization', function () {
    [, , , $session] = sessionPricingContext('owner', 'addon');

    $otherOrg  = Organization::factory()->create();
    $otherUser = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $otherOrg->id,
        'user_id'         => $otherUser->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    $this->actingAs($otherUser)
        ->getJson("/api/v1/sessions/{$session->id}/pricing")
        ->assertForbidden();
});
