<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create an org with a free active subscription and one member at the given role.
 * Returns [$org, $user].
 */
function billingAuthOrg(string $role = 'owner'): array
{
    $org  = Organization::factory()->create(['stripe_customer_id' => 'cus_auth_test']);
    Subscription::factory()->forOrganization($org->id)->free()->active()->create([
        'stripe_subscription_id' => 'sub_auth_test',
        'stripe_status'          => 'active',
    ]);

    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => $role,
        'is_active'       => true,
    ]);

    return [$org, $user];
}

// ─── GET /billing — view ─────────────────────────────────────────────────────

test('owner can view billing information', function () {
    [$org, $user] = billingAuthOrg('owner');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing")
        ->assertOk();
});

test('billing_admin can view billing information', function () {
    [$org, $user] = billingAuthOrg('billing_admin');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing")
        ->assertOk();
});

test('admin cannot view billing information', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing")
        ->assertForbidden();
});

test('staff cannot view billing information', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing")
        ->assertForbidden();
});

test('unauthenticated request to billing returns 401', function () {
    $org = Organization::factory()->create();

    $this->getJson("/api/v1/organizations/{$org->id}/billing")
        ->assertUnauthorized();
});

// ─── POST /billing/setup-intent ───────────────────────────────────────────────

test('owner can create a setup intent', function () {
    [$org, $user] = billingAuthOrg('owner');

    // Without a real Stripe key, the controller will throw a Stripe exception.
    // We accept 422/500 here — what matters is it did NOT return 403.
    $response = $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/setup-intent");

    expect($response->status())->not->toBe(403);
});

test('billing_admin can create a setup intent', function () {
    [$org, $user] = billingAuthOrg('billing_admin');

    $response = $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/setup-intent");

    expect($response->status())->not->toBe(403);
});

test('staff cannot create a setup intent', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/setup-intent")
        ->assertForbidden();
});

test('admin cannot create a setup intent', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/setup-intent")
        ->assertForbidden();
});

// ─── POST /billing/cancel — owner only ───────────────────────────────────────

test('owner can cancel a subscription', function () {
    [$org, $user] = billingAuthOrg('owner');

    // Without a real Stripe key the action will throw. We accept 422 or 500 but NOT 403.
    $response = $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/cancel");

    expect($response->status())->not->toBe(403);
});

test('billing_admin cannot cancel a subscription', function () {
    [$org, $user] = billingAuthOrg('billing_admin');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/cancel")
        ->assertForbidden();
});

test('admin cannot cancel a subscription', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/cancel")
        ->assertForbidden();
});

test('staff cannot cancel a subscription', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/cancel")
        ->assertForbidden();
});

// ─── POST /billing/resume ─────────────────────────────────────────────────────

test('owner can resume a subscription', function () {
    [$org, $user] = billingAuthOrg('owner');

    $response = $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/resume");

    // 422 = no pending-cancellation subscription found — auth passed.
    expect($response->status())->not->toBe(403);
});

test('billing_admin can resume a subscription', function () {
    [$org, $user] = billingAuthOrg('billing_admin');

    $response = $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/resume");

    expect($response->status())->not->toBe(403);
});

test('staff cannot resume a subscription', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/resume")
        ->assertForbidden();
});

test('admin cannot resume a subscription', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/resume")
        ->assertForbidden();
});

// ─── GET /billing/portal ──────────────────────────────────────────────────────

test('owner can access billing portal', function () {
    [$org, $user] = billingAuthOrg('owner');

    // Without real Stripe, returns 422 (no customer). Auth passed if not 403.
    $response = $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/portal");

    expect($response->status())->not->toBe(403);
});

test('billing_admin can access billing portal', function () {
    [$org, $user] = billingAuthOrg('billing_admin');

    $response = $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/portal");

    expect($response->status())->not->toBe(403);
});

test('staff cannot access billing portal', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/portal")
        ->assertForbidden();
});

test('admin cannot access billing portal', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/portal")
        ->assertForbidden();
});

// ─── POST /billing/checkout ───────────────────────────────────────────────────

test('owner can initiate checkout (reaches Stripe, not auth-blocked)', function () {
    [$org, $user] = billingAuthOrg('owner');
    config(['plans.pricing.starter.stripe_monthly_price_id' => null]);

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/checkout", [
        'plan_code' => 'starter',
        'billing'   => 'monthly',
    ])->assertStatus(422)->assertJsonFragment(['error' => 'stripe_not_configured']);
});

test('billing_admin can initiate checkout (reaches Stripe, not auth-blocked)', function () {
    [$org, $user] = billingAuthOrg('billing_admin');
    config(['plans.pricing.starter.stripe_monthly_price_id' => null]);

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/checkout", [
        'plan_code' => 'starter',
        'billing'   => 'monthly',
    ])->assertStatus(422)->assertJsonFragment(['error' => 'stripe_not_configured']);
});

test('staff cannot initiate checkout', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/checkout", [
        'plan_code' => 'starter',
        'billing'   => 'monthly',
    ])->assertForbidden();
});

test('admin cannot initiate checkout', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/billing/checkout", [
        'plan_code' => 'starter',
        'billing'   => 'monthly',
    ])->assertForbidden();
});

// ─── GET /billing/status ──────────────────────────────────────────────────────

test('owner can view billing status', function () {
    [$org, $user] = billingAuthOrg('owner');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/status")
        ->assertOk()
        ->assertJsonStructure(['plan_code', 'status', 'limits', 'features', 'usage']);
});

test('admin can view billing status', function () {
    [$org, $user] = billingAuthOrg('admin');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/status")
        ->assertOk();
});

test('staff can view billing status', function () {
    [$org, $user] = billingAuthOrg('staff');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/status")
        ->assertOk();
});

test('billing_admin can view billing status', function () {
    [$org, $user] = billingAuthOrg('billing_admin');

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/status")
        ->assertOk();
});

test('billing status hides stripe_customer_id from non-billing roles', function () {
    [$org, $user] = billingAuthOrg('staff');

    $response = $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/status");

    $response->assertOk();
    expect($response->json('stripe_customer_id'))->toBeNull();
});

test('billing status exposes stripe_customer_id to billing_admin', function () {
    $org  = Organization::factory()->create(['stripe_customer_id' => 'cus_visible']);
    Subscription::factory()->forOrganization($org->id)->starter()->active()->create([
        'stripe_customer_id' => 'cus_visible',
    ]);
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'billing_admin',
        'is_active'       => true,
    ]);

    $this->actingAs($user)->getJson("/api/v1/organizations/{$org->id}/billing/status")
        ->assertOk()
        ->assertJson(['stripe_customer_id' => 'cus_visible']);
});

// ─── Cross-tenant isolation ───────────────────────────────────────────────────

test('owner of org A cannot view billing for org B', function () {
    // Org A — user is owner
    $orgA = Organization::factory()->create();
    Subscription::factory()->forOrganization($orgA->id)->free()->active()->create();
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgA->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    // Org B — user has no relationship
    $orgB = Organization::factory()->create();
    Subscription::factory()->forOrganization($orgB->id)->free()->active()->create();

    $this->actingAs($user)->getJson("/api/v1/organizations/{$orgB->id}/billing")
        ->assertForbidden();
});

test('billing_admin of org A cannot cancel subscription for org B', function () {
    $orgA = Organization::factory()->create();
    Subscription::factory()->forOrganization($orgA->id)->free()->active()->create();
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgA->id,
        'user_id'         => $user->id,
        'role'            => 'billing_admin',
        'is_active'       => true,
    ]);

    $orgB = Organization::factory()->create();
    Subscription::factory()->forOrganization($orgB->id)->starter()->active()->create([
        'stripe_subscription_id' => 'sub_orgb',
    ]);

    $this->actingAs($user)->postJson("/api/v1/organizations/{$orgB->id}/billing/cancel")
        ->assertForbidden();
});

test('participant (no org membership) cannot access any billing endpoint', function () {
    $org  = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->free()->active()->create();

    $participant = User::factory()->create();
    // No OrganizationUser row — pure participant with no org membership

    $this->actingAs($participant)->getJson("/api/v1/organizations/{$org->id}/billing")
        ->assertForbidden();

    $this->actingAs($participant)->postJson("/api/v1/organizations/{$org->id}/billing/cancel")
        ->assertForbidden();

    $this->actingAs($participant)->getJson("/api/v1/organizations/{$org->id}/billing/status")
        ->assertForbidden();
});
