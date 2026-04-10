<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePlanOrg(string $plan, string $role = 'owner'): array
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

function workshopPayload(): array
{
    return [
        'workshop_type' => 'session_based',
        'title' => 'Test Workshop',
        'description' => 'A description',
        'timezone' => 'America/New_York',
        'start_date' => now()->addMonth()->format('Y-m-d'),
        'end_date' => now()->addMonth()->addDays(3)->format('Y-m-d'),
    ];
}

// ─── Workshop count limits ─────────────────────────────────────────────────────

test('free plan blocks creating a 3rd active workshop', function () {
    [$org, $user] = makePlanOrg('free');

    // Two active workshops (draft + draft) already at limit
    Workshop::factory()->forOrganization($org->id)->draft()->create();
    Workshop::factory()->forOrganization($org->id)->draft()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'plan_limit_exceeded'])
        ->assertJsonFragment(['required_plan' => 'starter']);
});

test('free plan allows creating when below active workshop limit', function () {
    [$org, $user] = makePlanOrg('free');

    // One draft workshop — one slot remaining
    Workshop::factory()->forOrganization($org->id)->draft()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(201);
});

test('archived workshops do not count against the active limit', function () {
    [$org, $user] = makePlanOrg('free');

    // Two archived + one draft = 1 active, limit is 2 → should allow creation
    Workshop::factory()->forOrganization($org->id)->archived()->create();
    Workshop::factory()->forOrganization($org->id)->archived()->create();
    Workshop::factory()->forOrganization($org->id)->draft()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(201);
});

test('starter plan blocks creating an 11th active workshop', function () {
    [$org, $user] = makePlanOrg('starter');

    // 10 draft workshops — at the Starter limit
    Workshop::factory()->forOrganization($org->id)->draft()->count(10)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'plan_limit_exceeded'])
        ->assertJsonFragment(['required_plan' => 'pro']);
});

test('starter plan allows creating when below limit', function () {
    [$org, $user] = makePlanOrg('starter');

    // 9 workshops — one slot remaining
    Workshop::factory()->forOrganization($org->id)->draft()->count(9)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(201);
});

test('pro plan has no workshop creation limit', function () {
    [$org, $user] = makePlanOrg('pro');

    // 50 workshops — pro has no limit
    Workshop::factory()->forOrganization($org->id)->draft()->count(50)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(201);
});

// ─── Participant per-workshop limits ──────────────────────────────────────────

test('free plan blocks the 76th participant registration', function () {
    [$org, $user] = makePlanOrg('free');

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    // Fill the workshop to exactly 75 registered participants
    $existingUsers = User::factory()->count(75)->create();
    foreach ($existingUsers as $u) {
        Registration::factory()->create([
            'workshop_id' => $workshop->id,
            'user_id' => $u->id,
            'registration_status' => 'registered',
        ]);
    }

    $newParticipant = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $newParticipant->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    // Actually, the participant just uses the join code — no org membership needed
    $this->actingAs($newParticipant, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => $workshop->join_code])
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'plan_limit_exceeded']);
});

test('free plan allows the 75th participant registration', function () {
    [$org, $user] = makePlanOrg('free');

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    // 74 registered participants — one slot remaining
    $existingUsers = User::factory()->count(74)->create();
    foreach ($existingUsers as $u) {
        Registration::factory()->create([
            'workshop_id' => $workshop->id,
            'user_id' => $u->id,
            'registration_status' => 'registered',
        ]);
    }

    $newParticipant = User::factory()->create();

    $this->actingAs($newParticipant, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => $workshop->join_code])
        ->assertStatus(201);
});

test('pro plan has no participant limit', function () {
    [$org, $user] = makePlanOrg('pro');

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    // 76 participants — past Free limit (75); Pro should not block
    $existingUsers = User::factory()->count(76)->create();
    foreach ($existingUsers as $u) {
        Registration::factory()->create([
            'workshop_id' => $workshop->id,
            'user_id' => $u->id,
            'registration_status' => 'registered',
        ]);
    }

    $newParticipant = User::factory()->create();

    $this->actingAs($newParticipant, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => $workshop->join_code])
        ->assertStatus(201);
});

// ─── Error response structure ──────────────────────────────────────────────────

test('plan limit 403 response is structured JSON never a 500', function () {
    [$org, $user] = makePlanOrg('free');

    Workshop::factory()->forOrganization($org->id)->draft()->count(2)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload());

    $response->assertStatus(403);
    $response->assertJsonStructure(['error', 'message', 'required_plan']);
    $response->assertJsonFragment(['error' => 'plan_limit_exceeded']);
});

// ─── Organization has no subscription (defaults to free) ──────────────────────

test('organization with no subscription defaults to free plan limits', function () {
    $org = Organization::factory()->create();
    // No subscription row created

    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    Workshop::factory()->forOrganization($org->id)->draft()->count(2)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopPayload())
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'plan_limit_exceeded']);
});

// ─── Feature gating (reporting routes) ────────────────────────────────────────

test('free plan cannot access attendance report', function () {
    [$org, $user] = makePlanOrg('free');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'plan_required'])
        ->assertJsonFragment(['required_plan' => 'starter']);
});

test('free plan cannot access workshops report', function () {
    [$org, $user] = makePlanOrg('free');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/workshops")
        ->assertStatus(403)
        ->assertJsonFragment(['error' => 'plan_required']);
});

test('starter plan can access attendance report', function () {
    [$org, $user] = makePlanOrg('starter');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk()
        ->assertJsonStructure(['summary', 'by_workshop', 'by_session', 'trend']);
});

test('pro plan can access attendance report', function () {
    [$org, $user] = makePlanOrg('pro');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk();
});

test('all plans can access usage report', function () {
    foreach (['free', 'starter', 'pro'] as $plan) {
        [$org, $user] = makePlanOrg($plan);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/organizations/{$org->id}/reports/usage")
            ->assertOk()
            ->assertJsonStructure(['data' => ['plan', 'limits', 'usage']]);
    }
});

// ─── Entitlements endpoint ────────────────────────────────────────────────────

// Note: JsonResource::withoutWrapping() is active globally — resources have no 'data' envelope.
test('entitlements endpoint returns plan feature set and limits', function () {
    [$org, $user] = makePlanOrg('starter');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/entitlements")
        ->assertOk()
        ->assertJsonStructure([
            'plan',
            'subscription_status',
            'limits' => ['max_active_workshops', 'max_participants_per_workshop', 'max_managers'],
            'features',
            'usage' => ['active_workshop_count', 'active_manager_count', 'active_leader_count'],
        ])
        ->assertJsonPath('plan', 'starter')
        ->assertJsonPath('limits.max_active_workshops', 10)
        ->assertJsonPath('features.reporting', true);
});

test('free plan entitlements reflect correct limits', function () {
    [$org, $user] = makePlanOrg('free');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/entitlements")
        ->assertOk()
        ->assertJsonPath('plan', 'free')
        ->assertJsonPath('limits.max_active_workshops', 2)
        ->assertJsonPath('limits.max_participants_per_workshop', 75)
        ->assertJsonPath('limits.max_managers', 1)
        ->assertJsonPath('features.reporting', false);
});

test('pro plan entitlements show null (unlimited) limits', function () {
    [$org, $user] = makePlanOrg('pro');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/entitlements")
        ->assertOk()
        ->assertJsonPath('limits.max_active_workshops', null)
        ->assertJsonPath('limits.max_participants_per_workshop', null);
});

// ─── Cross-tenant reporting denial ────────────────────────────────────────────

test('cross-tenant attempt on attendance report returns 403', function () {
    [$org, $user] = makePlanOrg('starter');

    $otherOrg = Organization::factory()->create();
    Subscription::factory()->forOrganization($otherOrg->id)->starter()->active()->create();

    // $user belongs to $org, not $otherOrg
    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}/reports/attendance")
        ->assertStatus(403);
});

test('cross-tenant attempt on workshops report returns 403', function () {
    [$org, $user] = makePlanOrg('starter');

    $otherOrg = Organization::factory()->create();
    Subscription::factory()->forOrganization($otherOrg->id)->starter()->active()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}/reports/workshops")
        ->assertStatus(403);
});

test('cross-tenant attempt on usage report returns 403', function () {
    [$org, $user] = makePlanOrg('free');

    $otherOrg = Organization::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}/reports/usage")
        ->assertStatus(403);
});
