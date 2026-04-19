<?php

use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReportsOrg(string $plan): array
{
    $org = Organization::factory()->create();
    $owner = User::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    if ($plan !== 'free') {
        Subscription::factory()->create([
            'organization_id' => $org->id,
            'plan_code' => $plan,
            'status' => 'active',
            'starts_at' => now()->subMonth(),
        ]);
    }

    return [$org, $owner];
}

// ─── Attendance report ────────────────────────────────────────────────────────

test('attendance report returns correct rates', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $session = Session::factory()->create(['workshop_id' => $workshop->id, 'is_published' => true]);

    // 4 registered participants
    for ($i = 0; $i < 4; $i++) {
        Registration::factory()->create([
            'workshop_id' => $workshop->id,
            'registration_status' => 'registered',
        ]);
    }

    // 2 checked in, 1 no-show
    $p1 = User::factory()->create();
    $p2 = User::factory()->create();
    $p3 = User::factory()->create();

    AttendanceRecord::factory()->create(['session_id' => $session->id, 'user_id' => $p1->id, 'status' => 'checked_in']);
    AttendanceRecord::factory()->create(['session_id' => $session->id, 'user_id' => $p2->id, 'status' => 'checked_in']);
    AttendanceRecord::factory()->create(['session_id' => $session->id, 'user_id' => $p3->id, 'status' => 'no_show']);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk();

    expect($response->json('summary.total_registered'))->toBe(4);
    expect($response->json('summary.total_checked_in'))->toBe(2);
    expect($response->json('summary.total_no_show'))->toBe(1);
    // 2/4 = 0.5
    expect($response->json('summary.attendance_rate'))->toBeGreaterThan(0.49)->toBeLessThan(0.51);
});

test('attendance report filters by workshop_id correctly', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $w1 = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $w2 = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    Registration::factory()->count(3)->create(['workshop_id' => $w1->id, 'registration_status' => 'registered']);
    Registration::factory()->count(5)->create(['workshop_id' => $w2->id, 'registration_status' => 'registered']);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance?workshop_id={$w1->id}")
        ->assertOk();

    // Only w1 registrations should be in the summary
    expect($response->json('summary.total_registered'))->toBe(3);

    // by_workshop should only contain w1
    $workshopIds = array_column($response->json('by_workshop'), 'workshop_id');
    expect($workshopIds)->toContain($w1->id);
    expect($workshopIds)->not->toContain($w2->id);

    // by_session should be present when workshop_id filter applied
    expect($response->json('by_session'))->not->toBeNull();
});

test('workshops report lists all org workshops with stats', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'status' => 'published',
    ]);

    Session::factory()->count(3)->create(['workshop_id' => $workshop->id]);
    Registration::factory()->count(5)->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/workshops")
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'workshop_id', 'title', 'status', 'workshop_type',
                    'start_date', 'end_date', 'session_count', 'leader_count',
                    'registered_count', 'capacity_total', 'capacity_utilization', 'attendance_rate',
                ],
            ],
        ]);

    $entry = collect($response->json('data'))->firstWhere('workshop_id', $workshop->id);
    expect($entry['session_count'])->toBe(3);
    expect($entry['registered_count'])->toBe(5);
});

test('participants report requires workshop_id', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/participants")
        ->assertUnprocessable(); // 422 — validation fails
});

test('participants report returns participant list for the workshop', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    $participant = User::factory()->create();
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $participant->id,
        'registration_status' => 'registered',
        'registered_at' => now()->subDays(2),
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/participants?workshop_id={$workshop->id}")
        ->assertOk()
        ->assertJsonStructure([
            'workshop_title',
            'participants' => [
                '*' => [
                    'user_id', 'first_name', 'last_name', 'email',
                    'registered_at', 'sessions_selected', 'sessions_attended', 'last_check_in',
                ],
            ],
        ]);

    expect($response->json('workshop_title'))->toBe($workshop->title);
    $p = collect($response->json('participants'))->firstWhere('user_id', $participant->id);
    expect($p)->not->toBeNull();
    expect($p['email'])->toBe($participant->email);
});

test('export returns csv with correct headers for attendance', function () {
    [$org, $owner] = makeReportsOrg('starter');

    Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    $response = $this->actingAs($owner, 'sanctum')
        ->get("/api/v1/organizations/{$org->id}/reports/export?type=attendance&format=csv")
        ->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('text/csv');
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');

    $content = $response->getContent();
    expect(str_contains($content, 'workshop_id'))->toBeTrue();
    expect(str_contains($content, 'attendance_rate'))->toBeTrue();
});

test('export returns csv with correct headers for participants', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $participant = User::factory()->create();
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $participant->id,
        'registration_status' => 'registered',
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->get("/api/v1/organizations/{$org->id}/reports/export?type=participants&workshop_id={$workshop->id}&format=csv")
        ->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('text/csv');

    $content = $response->getContent();
    expect(str_contains($content, 'first_name'))->toBeTrue();
    expect(str_contains($content, 'sessions_attended'))->toBeTrue();
});

test('free plan is blocked from all report endpoints', function () {
    [$org, $owner] = makeReportsOrg('free');

    foreach (['attendance', 'workshops', 'participants', 'export'] as $endpoint) {
        $this->actingAs($owner, 'sanctum')
            ->getJson("/api/v1/organizations/{$org->id}/reports/{$endpoint}")
            ->assertForbidden()
            ->assertJsonPath('error', 'plan_required')
            ->assertJsonPath('required_plan', 'starter');
    }
});

test('starter plan can access attendance report', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk()
        ->assertJsonStructure(['summary', 'by_workshop', 'by_session', 'trend']);
});

test('cross-workshop trend is null for starter plan', function () {
    [$org, $owner] = makeReportsOrg('starter');

    $trend = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk()
        ->json('trend');

    expect($trend)->toBeNull();
});

test('cross-workshop trend is populated for pro plan', function () {
    [$org, $owner] = makeReportsOrg('pro');

    $workshop = Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);

    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'registration_status' => 'registered',
        'registered_at' => now(),
    ]);

    $trend = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk()
        ->json('trend');

    expect($trend)->toHaveCount(12);
    $recentWeek = last($trend);
    expect($recentWeek['registrations'])->toBeGreaterThanOrEqual(1);
});

test('cross-tenant report access returns 403', function () {
    [$org, $owner] = makeReportsOrg('starter');
    [$otherOrg, $otherOwner] = makeReportsOrg('starter');

    // $owner tries to access $otherOrg's reports
    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}/reports/attendance")
        ->assertForbidden();
});

test('workshops report only includes org workshops, not cross-tenant', function () {
    [$org, $owner] = makeReportsOrg('starter');
    [$otherOrg, $otherOwner] = makeReportsOrg('starter');

    Workshop::factory()->create(['organization_id' => $org->id, 'status' => 'published']);
    $otherWorkshop = Workshop::factory()->create(['organization_id' => $otherOrg->id, 'status' => 'published']);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/workshops")
        ->assertOk();

    $ids = array_column($response->json('data'), 'workshop_id');
    expect($ids)->not->toContain($otherWorkshop->id);
});
