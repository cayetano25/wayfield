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

function makeStarterOrg(): array
{
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->creator()->active()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    return [$org, $owner];
}

// ─── Attendance report ────────────────────────────────────────────────────────

test('attendance report returns data for all org workshops', function () {
    [$org, $owner] = makeStarterOrg();

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->sessionBased()->create();
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $participant = User::factory()->create();
    AttendanceRecord::factory()->create([
        'session_id' => $session->id,
        'user_id' => $participant->id,
        'status' => 'checked_in',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk()
        ->assertJsonStructure([
            'summary' => [
                'total_registered',
                'total_checked_in',
                'total_no_show',
                'attendance_rate',
                'no_show_rate',
                'date_range',
            ],
            'by_workshop' => [
                '*' => [
                    'workshop_id',
                    'workshop_title',
                    'start_date',
                    'registered',
                    'checked_in',
                    'no_show',
                    'attendance_rate',
                ],
            ],
            'by_session',
            'trend',
        ]);
});

test('attendance report only returns data for the requesting org', function () {
    [$org, $owner] = makeStarterOrg();

    $otherOrg = Organization::factory()->create();
    $otherWorkshop = Workshop::factory()->forOrganization($otherOrg->id)->published()->create();

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance")
        ->assertOk();

    // Only the org's workshop should be present
    $data = $response->json('by_workshop');
    $workshopIds = collect($data)->pluck('workshop_id')->all();

    expect($workshopIds)->toContain($workshop->id);
    expect($workshopIds)->not->toContain($otherWorkshop->id);
});

test('attendance report supports workshop_id filter', function () {
    [$org, $owner] = makeStarterOrg();

    $w1 = Workshop::factory()->forOrganization($org->id)->published()->create();
    $w2 = Workshop::factory()->forOrganization($org->id)->published()->create();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance?workshop_id={$w1->id}")
        ->assertOk();

    $data = $response->json('by_workshop');
    $workshopIds = collect($data)->pluck('workshop_id')->all();

    expect($workshopIds)->toContain($w1->id);
    expect($workshopIds)->not->toContain($w2->id);
});

test('attendance report correctly counts checked_in and no_show', function () {
    [$org, $owner] = makeStarterOrg();

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->sessionBased()->create();
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $u1 = User::factory()->create();
    $u2 = User::factory()->create();
    $u3 = User::factory()->create();

    AttendanceRecord::factory()->create(['session_id' => $session->id, 'user_id' => $u1->id, 'status' => 'checked_in']);
    AttendanceRecord::factory()->create(['session_id' => $session->id, 'user_id' => $u2->id, 'status' => 'no_show']);
    AttendanceRecord::factory()->create(['session_id' => $session->id, 'user_id' => $u3->id, 'status' => 'not_checked_in']);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/attendance?workshop_id={$workshop->id}")
        ->assertOk();

    $sessionData = $response->json('by_session.0');

    expect($sessionData['checked_in'])->toBe(1);
    expect($sessionData['no_show'])->toBe(1);
});

// ─── Workshops report ─────────────────────────────────────────────────────────

test('workshops report returns summary for all org workshops', function () {
    [$org, $owner] = makeStarterOrg();

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->sessionBased()->create();
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    $participant = User::factory()->create();
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $participant->id,
        'registration_status' => 'registered',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/workshops")
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => [
                    'workshop_id',
                    'title',
                    'status',
                    'workshop_type',
                    'start_date',
                    'end_date',
                    'session_count',
                    'leader_count',
                    'registered_count',
                    'capacity_total',
                    'capacity_utilization',
                    'attendance_rate',
                ],
            ],
        ]);
});

test('workshops report only returns data for the requesting org', function () {
    [$org, $owner] = makeStarterOrg();

    $otherOrg = Organization::factory()->create();
    $otherWorkshop = Workshop::factory()->forOrganization($otherOrg->id)->published()->create();

    $ownWorkshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/workshops")
        ->assertOk();

    $workshopIds = collect($response->json('data'))->pluck('workshop_id')->all();

    expect($workshopIds)->toContain($ownWorkshop->id);
    expect($workshopIds)->not->toContain($otherWorkshop->id);
});

// ─── Usage report ─────────────────────────────────────────────────────────────

test('usage report returns current plan, limits, and usage counts', function () {
    [$org, $owner] = makeStarterOrg();

    Workshop::factory()->forOrganization($org->id)->draft()->count(3)->create();

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/usage")
        ->assertOk()
        ->assertJsonPath('data.plan', 'creator')
        ->assertJsonPath('data.limits.max_active_workshops', 10)
        ->assertJsonStructure([
            'data' => [
                'plan',
                'limits',
                'usage' => [
                    'active_workshop_count',
                    'total_workshop_count',
                    'active_manager_count',
                    'active_leader_count',
                    'total_participant_count',
                    'participants_by_workshop',
                ],
            ],
        ]);
});

test('usage report counts active workshops correctly', function () {
    [$org, $owner] = makeStarterOrg();

    Workshop::factory()->forOrganization($org->id)->draft()->count(2)->create();
    Workshop::factory()->forOrganization($org->id)->published()->count(1)->create();
    Workshop::factory()->forOrganization($org->id)->archived()->count(5)->create();

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/reports/usage")
        ->assertOk()
        ->assertJsonPath('data.usage.active_workshop_count', 3); // 2 draft + 1 published
});

// ─── Subscription endpoint ────────────────────────────────────────────────────

test('subscription endpoint returns plan info', function () {
    [$org, $owner] = makeStarterOrg();

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/subscription")
        ->assertOk()
        ->assertJsonFragment(['plan_code' => 'creator'])
        ->assertJsonFragment(['status' => 'active']);
});

test('subscription endpoint returns free plan info when no subscription exists', function () {
    $org = Organization::factory()->create();
    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/subscription")
        ->assertOk()
        ->assertJsonFragment(['plan_code' => 'foundation'])
        ->assertJsonFragment(['status' => 'none']);
});

test('cross-tenant user cannot access subscription endpoint', function () {
    [$org, $owner] = makeStarterOrg();

    $otherOrg = Organization::factory()->create();

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}/subscription")
        ->assertStatus(403);
});
