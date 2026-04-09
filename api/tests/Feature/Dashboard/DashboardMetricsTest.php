<?php

use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a minimal org + admin user fixture for a given plan.
 * Returns [$user, $org].
 */
function makeDashboardScenario(string $plan): array
{
    $org = Organization::factory()->create();
    $user = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    if ($plan !== 'none') {
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_code' => $plan,
            'status' => 'active',
        ]);
    }

    return [$user, $org];
}

// ─── Core Metrics — All Plans ─────────────────────────────────────────────────

test('dashboard returns core metrics for free plan', function () {
    [$user, $org] = makeDashboardScenario('free');

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->assertJsonStructure([
            'core' => ['workshops', 'participants', 'sessions_this_month', 'attendance', 'plan'],
            'analytics' => ['attendance_metrics', 'capacity_metrics', 'session_breakdown', 'registration_trend'],
            'stubs' => ['revenue', 'satisfaction', 'engagement', 'learning_outcomes'],
        ]);
});

test('free plan dashboard returns null for all analytics metrics', function () {
    [$user, $org] = makeDashboardScenario('free');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics');

    expect($response['attendance_metrics'])->toBeNull();
    expect($response['capacity_metrics'])->toBeNull();
    expect($response['session_breakdown'])->toBeNull();
    expect($response['registration_trend'])->toBeNull();
});

test('dashboard core shows correct participant count', function () {
    [$user, $org] = makeDashboardScenario('free');

    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status' => 'published',
    ]);

    Registration::factory()->count(3)->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->assertJsonPath('core.participants.total_registered', 3);
});

// ─── Starter Plan Analytics ───────────────────────────────────────────────────

test('starter plan returns attendance_metrics, capacity_metrics, and session_breakdown', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics');

    expect($response['attendance_metrics'])->not->toBeNull();
    expect($response['capacity_metrics'])->not->toBeNull();
    expect($response['session_breakdown'])->not->toBeNull();
});

test('attendance rate calculation is correct', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $session = Session::factory()->create(['workshop_id' => $workshop->id, 'is_published' => true]);

    Registration::factory()->count(3)->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
    ]);

    AttendanceRecord::factory()->checkedIn()->forSession($session->id)->create();

    $rate = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.attendance_metrics.attendance_rate');

    // 1 checked-in / 3 registered ≈ 0.3333
    expect($rate)->toBeGreaterThan(0.332)->toBeLessThan(0.334);
});

test('no show rate calculation is correct', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $session = Session::factory()->create(['workshop_id' => $workshop->id, 'is_published' => true]);

    Registration::factory()->count(3)->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
    ]);

    AttendanceRecord::factory()->noShow()->forSession($session->id)->create();

    $rate = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.attendance_metrics.no_show_rate');

    // 1 no-show / 3 registered ≈ 0.3333
    expect($rate)->toBeGreaterThan(0.332)->toBeLessThan(0.334);
});

test('attendance rate is null when no registrations exist', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $rate = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.attendance_metrics.attendance_rate');

    expect($rate)->toBeNull();
});

test('starter plan returns session breakdown ordered by enrollment desc', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $session1 = Session::factory()->create(['workshop_id' => $workshop->id, 'is_published' => true]);
    $session2 = Session::factory()->create(['workshop_id' => $workshop->id, 'is_published' => true]);

    // 2 enrollments in session1, 0 in session2
    $reg1 = Registration::factory()->create(['workshop_id' => $workshop->id, 'registration_status' => 'registered']);
    $reg2 = Registration::factory()->create(['workshop_id' => $workshop->id, 'registration_status' => 'registered']);

    SessionSelection::factory()->create(['session_id' => $session1->id, 'registration_id' => $reg1->id, 'selection_status' => 'selected']);
    SessionSelection::factory()->create(['session_id' => $session1->id, 'registration_id' => $reg2->id, 'selection_status' => 'selected']);

    $breakdown = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.session_breakdown');

    expect($breakdown[0]['session_id'])->toBe($session1->id);
    expect($breakdown[0]['enrolled_count'])->toBe(2);
    expect($breakdown[1]['enrolled_count'])->toBe(0);
});

test('starter plan returns capacity utilization', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $session = Session::factory()->create([
        'workshop_id' => $workshop->id,
        'is_published' => true,
        'capacity' => 10,
    ]);

    $reg1 = Registration::factory()->create(['workshop_id' => $workshop->id, 'registration_status' => 'registered']);
    $reg2 = Registration::factory()->create(['workshop_id' => $workshop->id, 'registration_status' => 'registered']);

    SessionSelection::factory()->create(['session_id' => $session->id, 'registration_id' => $reg1->id, 'selection_status' => 'selected']);
    SessionSelection::factory()->create(['session_id' => $session->id, 'registration_id' => $reg2->id, 'selection_status' => 'selected']);

    $utilization = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.capacity_metrics.capacity_utilization');

    // 2 enrolled / 10 capacity = 0.2
    expect($utilization)->toBeGreaterThan(0.19)->toBeLessThan(0.21);
});

test('capacity utilization is null when all sessions have unlimited capacity', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    // Session with null capacity = unlimited
    Session::factory()->create([
        'workshop_id' => $workshop->id,
        'is_published' => true,
        'capacity' => null,
    ]);

    $utilization = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.capacity_metrics.capacity_utilization');

    expect($utilization)->toBeNull();
});

test('starter plan returns null for registration trend', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $trend = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.registration_trend');

    expect($trend)->toBeNull();
});

// ─── Pro Plan Analytics ───────────────────────────────────────────────────────

test('pro plan returns registration trend with exactly 12 weeks', function () {
    [$user, $org] = makeDashboardScenario('pro');

    $trend = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.registration_trend');

    expect($trend)->toHaveCount(12);
});

test('registration trend includes weeks with zero registrations', function () {
    [$user, $org] = makeDashboardScenario('pro');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    // Only register in the most recent week — the other 11 weeks should have 0
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
        'registered_at' => now(),
    ]);

    $trend = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.registration_trend');

    expect($trend)->toHaveCount(12);

    $counts = array_column($trend, 'registrations');

    // At least some weeks must be 0 (the 11 older weeks have no registrations)
    expect(in_array(0, $counts, true))->toBeTrue();
});

// ─── Pro Plan — All Analytics Populated ───────────────────────────────────────

test('pro plan returns all four analytics keys populated', function () {
    [$user, $org] = makeDashboardScenario('pro');

    $analytics = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics');

    expect($analytics['attendance_metrics'])->not->toBeNull();
    expect($analytics['capacity_metrics'])->not->toBeNull();
    expect($analytics['session_breakdown'])->not->toBeNull();
    expect($analytics['registration_trend'])->not->toBeNull();
});

// ─── Both Rates Null When No Registrations ────────────────────────────────────

test('no_show_rate is null when no registrations exist', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $noShowRate = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.attendance_metrics.no_show_rate');

    expect($noShowRate)->toBeNull();
});

// ─── Session Breakdown Max 10 ─────────────────────────────────────────────────

test('session breakdown returns at most 10 entries even when more sessions exist', function () {
    [$user, $org] = makeDashboardScenario('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    // Create 12 published sessions — breakdown must cap at 10
    Session::factory()->count(12)->create([
        'workshop_id' => $workshop->id,
        'is_published' => true,
    ]);

    $breakdown = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('analytics.session_breakdown');

    expect(count($breakdown))->toBe(10);
});

// ─── Stub Metrics — All Plans ─────────────────────────────────────────────────

test('dashboard always returns stub metrics regardless of plan', function () {
    foreach (['free', 'starter', 'pro'] as $plan) {
        [$user, $org] = makeDashboardScenario($plan);

        $stubs = $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/organizations/{$org->id}/dashboard")
            ->assertOk()
            ->json('stubs');

        expect($stubs['revenue']['stub'])->toBeTrue();
        expect($stubs['satisfaction']['stub'])->toBeTrue();
        expect($stubs['engagement']['stub'])->toBeTrue();
        expect($stubs['learning_outcomes']['stub'])->toBeTrue();
    }
});

test('all stub metrics have an available_on field', function () {
    [$user, $org] = makeDashboardScenario('free');

    $stubs = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk()
        ->json('stubs');

    expect($stubs['revenue']['available_on'])->toBe('starter');
    expect($stubs['satisfaction']['available_on'])->toBe('starter');
    expect($stubs['engagement']['available_on'])->toBe('pro');
    expect($stubs['learning_outcomes']['available_on'])->toBe('pro');
});

// ─── Security: Plan Spoofing ──────────────────────────────────────────────────

test('plan_code cannot be spoofed via query string to unlock analytics', function () {
    [$user, $org] = makeDashboardScenario('free');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/dashboard?plan=pro")
        ->assertOk()
        ->json('analytics');

    expect($response['attendance_metrics'])->toBeNull();
    expect($response['capacity_metrics'])->toBeNull();
    expect($response['session_breakdown'])->toBeNull();
    expect($response['registration_trend'])->toBeNull();
});

test('plan_code cannot be spoofed via request body to unlock analytics', function () {
    [$user, $org] = makeDashboardScenario('free');

    // Send a JSON body containing a plan override — must be ignored
    $response = $this->actingAs($user, 'sanctum')
        ->json('GET', "/api/v1/organizations/{$org->id}/dashboard", ['plan_code' => 'pro', 'plan' => 'enterprise'])
        ->assertOk()
        ->json('analytics');

    expect($response['attendance_metrics'])->toBeNull();
    expect($response['capacity_metrics'])->toBeNull();
    expect($response['session_breakdown'])->toBeNull();
    expect($response['registration_trend'])->toBeNull();
});

// ─── Authorization ────────────────────────────────────────────────────────────

test('dashboard is not accessible to user from different organization', function () {
    [$user, $org] = makeDashboardScenario('free');
    [, $otherOrg] = makeDashboardScenario('free');

    // $user belongs to $org but not $otherOrg
    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}/dashboard")
        ->assertForbidden();
});

// ─── Workshop-Scoped Analytics ────────────────────────────────────────────────

test('workshop analytics endpoint scopes data to single workshop', function () {
    [$user, $org] = makeDashboardScenario('free');

    $workshop1 = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $workshop2 = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    // 3 registrations in workshop1, 1 in workshop2
    Registration::factory()->count(3)->create([
        'workshop_id' => $workshop1->id,
        'registration_status' => 'registered',
    ]);
    Registration::factory()->count(1)->create([
        'workshop_id' => $workshop2->id,
        'registration_status' => 'registered',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop1->id}/analytics")
        ->assertOk()
        ->assertJsonPath('core.participants.total_registered', 3);
});
