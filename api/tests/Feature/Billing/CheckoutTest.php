<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Stripe\Webhook;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function billingOrg(string $plan = 'free', string $role = 'owner'): array
{
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->active()->$plan()->create();

    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);

    return [$org, $user];
}

// ─── POST /api/v1/billing/checkout ───────────────────────────────────────────

test('owner can create a checkout session for starter plan', function () {
    [$org, $user] = billingOrg('free', 'owner');

    // In test env no Stripe price IDs are set, so the controller returns 422
    // with stripe_not_configured — which proves the owner cleared the auth check.
    config(['plans.pricing.starter.stripe_monthly_price_id' => null]);

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'starter',
        'billing' => 'monthly',
    ]);

    // 422 means auth passed but Stripe is not configured (expected in test env).
    // A 403 would mean the owner was incorrectly rejected.
    $response->assertStatus(422);
    $response->assertJsonFragment(['error' => 'stripe_not_configured']);
});

test('staff cannot create a checkout session', function () {
    [$org, $user] = billingOrg('free', 'staff');

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'starter',
        'billing' => 'monthly',
    ]);

    $response->assertStatus(403);
});

test('admin cannot create a checkout session', function () {
    [$org, $user] = billingOrg('free', 'admin');

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'starter',
        'billing' => 'monthly',
    ]);

    $response->assertStatus(403);
});

test('billing_admin can initiate a checkout session', function () {
    [$org, $user] = billingOrg('free', 'billing_admin');

    // Ensure no price ID so controller reaches the Stripe-not-configured check
    config(['plans.pricing.starter.stripe_monthly_price_id' => null]);

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'starter',
        'billing' => 'monthly',
    ]);

    // 422 = billing_admin passed the auth check but Stripe isn't configured.
    // A 403 would mean billing_admin was incorrectly rejected.
    $response->assertStatus(422);
    $response->assertJsonFragment(['error' => 'stripe_not_configured']);
});

test('free plan cannot be submitted to checkout endpoint', function () {
    [$org, $user] = billingOrg('free', 'owner');

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'free',
        'billing' => 'monthly',
    ]);

    $response->assertStatus(422);
});

test('enterprise plan cannot be submitted to checkout endpoint', function () {
    [$org, $user] = billingOrg('free', 'owner');

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'enterprise',
        'billing' => 'monthly',
    ]);

    $response->assertStatus(422);
});

test('checkout returns 422 when no Stripe price is configured for the plan', function () {
    [$org, $user] = billingOrg('free', 'owner');

    // Ensure no price ID is set
    config(['plans.pricing.starter.stripe_monthly_price_id' => null]);

    $response = $this->actingAs($user)->postJson('/api/v1/billing/checkout', [
        'org_id' => $org->id,
        'plan_code' => 'starter',
        'billing' => 'monthly',
    ]);

    $response->assertStatus(422);
    $response->assertJsonFragment(['error' => 'stripe_not_configured']);
});

// ─── POST /api/v1/billing/webhook ────────────────────────────────────────────

test('webhook with invalid signature returns 400', function () {
    config(['services.stripe.webhook_secret' => 'whsec_test_secret']);

    $response = $this->postJson('/api/v1/billing/webhook', [], [
        'Stripe-Signature' => 'invalid_signature',
    ]);

    $response->assertStatus(400);
    $response->assertJsonFragment(['error' => 'Invalid signature']);
});

test('webhook checkout.session.completed updates subscription plan_code', function () {
    $org = Organization::factory()->create();
    $subscription = Subscription::factory()
        ->forOrganization($org->id)
        ->free()
        ->active()
        ->create();

    $webhookSecret = 'whsec_test_secret_'.uniqid();
    config(['services.stripe.webhook_secret' => $webhookSecret]);

    $payload = json_encode([
        'id' => 'evt_test_'.uniqid(),
        'type' => 'checkout.session.completed',
        'data' => [
            'object' => [
                'id' => 'cs_test_'.uniqid(),
                'customer' => 'cus_test_123',
                'subscription' => 'sub_test_123',
                'metadata' => [
                    'organization_id' => (string) $org->id,
                    'plan_code' => 'starter',
                    'billing' => 'monthly',
                ],
            ],
        ],
    ]);

    // Build a valid Stripe webhook signature
    $timestamp = time();
    $signedPayload = "{$timestamp}.{$payload}";
    $signature = hash_hmac('sha256', $signedPayload, $webhookSecret);
    $stripeSignature = "t={$timestamp},v1={$signature}";

    $response = $this->call(
        'POST',
        '/api/v1/billing/webhook',
        [],
        [],
        [],
        ['HTTP_Stripe-Signature' => $stripeSignature, 'CONTENT_TYPE' => 'application/json'],
        $payload,
    );

    $response->assertOk();

    $this->assertDatabaseHas('subscriptions', [
        'id' => $subscription->id,
        'plan_code' => 'starter',
        'status' => 'active',
        'billing_cycle' => 'monthly',
    ]);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'action' => 'organization.plan_upgraded',
    ]);
});

// ─── plan_limit_reached error shape ──────────────────────────────────────────

test('limit-hit on workshop creation returns plan_limit_reached error shape', function () {
    [$org, $user] = billingOrg('free', 'owner');

    // Create 2 workshops to hit the Free plan limit
    Workshop::factory()->forOrganization($org->id)->draft()->create();
    Workshop::factory()->forOrganization($org->id)->draft()->create();

    $response = $this->actingAs($user)->postJson("/api/v1/organizations/{$org->id}/workshops", [
        'workshop_type' => 'session_based',
        'title' => 'Third Workshop',
        'description' => 'Should fail',
        'timezone' => 'America/New_York',
        'start_date' => now()->addMonth()->format('Y-m-d'),
        'end_date' => now()->addMonth()->addDays(3)->format('Y-m-d'),
    ]);

    $response->assertStatus(403);
    $response->assertJsonFragment(['error' => 'plan_limit_reached']);
    $response->assertJsonFragment(['limit_key' => 'active_workshops']);
    $response->assertJsonStructure([
        'error',
        'limit_key',
        'current_count',
        'limit',
        'current_plan',
        'current_plan_display',
        'upgrade_to',
        'upgrade_to_display',
        'upgrade_url',
        'message',
    ]);

    $data = $response->json();
    expect($data['current_plan'])->toBe('free');
    expect($data['current_plan_display'])->toBe('Foundation');
    expect($data['upgrade_to'])->toBe('starter');
    expect($data['upgrade_to_display'])->toBe('Creator');
    expect($data['upgrade_url'])->toBe('/admin/organization/billing');
    expect($data['limit'])->toBe(2);
    expect($data['current_count'])->toBe(2);
});

test('limit-hit on participant join returns plan_limit_reached error shape', function () {
    [$org, $user] = billingOrg('free', 'owner');

    $workshop = Workshop::factory()->forOrganization($org->id)->create([
        'status' => 'published',
        'join_code' => 'TESTJOIN',
    ]);

    // Fill the workshop to its participant limit (75 for free)
    Registration::factory()->count(75)->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
    ]);

    $participant = User::factory()->create();

    $response = $this->actingAs($participant)->postJson('/api/v1/workshops/join', [
        'join_code' => 'TESTJOIN',
    ]);

    $response->assertStatus(403);
    $response->assertJsonFragment(['error' => 'plan_limit_reached']);
    $response->assertJsonFragment(['limit_key' => 'participants_per_workshop']);
    $response->assertJsonStructure([
        'error',
        'limit_key',
        'current_count',
        'limit',
        'current_plan',
        'current_plan_display',
        'upgrade_to',
        'upgrade_to_display',
        'upgrade_url',
        'message',
    ]);
});
