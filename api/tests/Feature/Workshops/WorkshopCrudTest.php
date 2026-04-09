<?php

use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Create ────────────────────────────────────────────────────────────────────

test('owner can create a workshop', function () {
    [$user, $org] = makeOwner();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", [
            'workshop_type' => 'event_based',
            'title' => 'Mountain Light Workshop',
            'description' => 'A photography workshop in the mountains.',
            'timezone' => 'America/Denver',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-03',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('title', 'Mountain Light Workshop')
        ->assertJsonPath('status', 'draft')
        ->assertJsonPath('workshop_type', 'event_based')
        ->assertJsonPath('timezone', 'America/Denver');

    expect($response->json('join_code'))->not->toBeNull()
        ->and(strlen($response->json('join_code')))->toBeGreaterThan(0);

    $this->assertDatabaseHas('workshops', [
        'organization_id' => $org->id,
        'title' => 'Mountain Light Workshop',
        'status' => 'draft',
    ]);
});

test('workshop creation generates a unique join_code', function () {
    [$user, $org] = makeOwner();

    $payload = [
        'workshop_type' => 'event_based',
        'title' => 'Workshop',
        'description' => 'Desc',
        'timezone' => 'UTC',
        'start_date' => '2026-08-01',
        'end_date' => '2026-08-02',
    ];

    $r1 = $this->actingAs($user, 'sanctum')->postJson("/api/v1/organizations/{$org->id}/workshops", $payload);
    $r2 = $this->actingAs($user, 'sanctum')->postJson("/api/v1/organizations/{$org->id}/workshops", $payload);

    $r1->assertStatus(201);
    $r2->assertStatus(201);

    expect($r1->json('join_code'))->not->toBe($r2->json('join_code'));
});

test('join_code is 8 uppercase characters with no confusable characters', function () {
    [$user, $org] = makeOwner();

    $response = $this->actingAs($user, 'sanctum')->postJson("/api/v1/organizations/{$org->id}/workshops", [
        'workshop_type' => 'event_based',
        'title' => 'Charset Test Workshop',
        'description' => 'Desc',
        'timezone' => 'UTC',
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-02',
    ]);

    $response->assertStatus(201);
    $code = $response->json('join_code');

    expect($code)->toHaveLength(8);
    // Must match only the safe charset — no 0, O, 1, I
    expect($code)->toMatch('/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/');
});

test('workshop requires timezone', function () {
    [$user, $org] = makeOwner();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", [
            'workshop_type' => 'event_based',
            'title' => 'Workshop',
            'description' => 'Desc',
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-02',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['timezone']);
});

test('workshop end_date must not be before start_date', function () {
    [$user, $org] = makeOwner();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", [
            'workshop_type' => 'event_based',
            'title' => 'Workshop',
            'description' => 'Desc',
            'timezone' => 'UTC',
            'start_date' => '2026-08-05',
            'end_date' => '2026-08-01',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['end_date']);
});

test('staff cannot create a workshop', function () {
    [$user, $org] = makeStaff();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", [
            'workshop_type' => 'event_based',
            'title' => 'Workshop',
            'description' => 'Desc',
            'timezone' => 'UTC',
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-02',
        ])
        ->assertStatus(403);
});

test('non-member cannot create a workshop', function () {
    $outsider = User::factory()->create();
    $org = Organization::factory()->create();

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", [
            'workshop_type' => 'event_based',
            'title' => 'Workshop',
            'description' => 'Desc',
            'timezone' => 'UTC',
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-02',
        ])
        ->assertStatus(403);
});

// ─── Read ──────────────────────────────────────────────────────────────────────

test('owner can list workshops scoped to their organization', function () {
    [$user, $org] = makeOwner();

    $ownWorkshop = Workshop::factory()->forOrganization($org->id)->create();
    $otherWorkshop = Workshop::factory()->create(); // different org

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/workshops");

    $response->assertStatus(200);

    $ids = collect($response->json())->pluck('id');
    expect($ids)->toContain($ownWorkshop->id)
        ->and($ids)->not->toContain($otherWorkshop->id);
});

test('owner can view a single workshop', function () {
    [$user, $org] = makeOwner();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}")
        ->assertStatus(200)
        ->assertJsonPath('id', $workshop->id);
});

test('non-member cannot view a workshop', function () {
    $outsider = User::factory()->create();
    $workshop = Workshop::factory()->create();

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}")
        ->assertStatus(403);
});

// ─── Update ────────────────────────────────────────────────────────────────────

test('owner can update a workshop', function () {
    [$user, $org] = makeOwner();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", ['title' => 'Updated Title'])
        ->assertStatus(200)
        ->assertJsonPath('title', 'Updated Title');
});

test('archived workshop cannot be updated', function () {
    [$user, $org] = makeOwner();
    $workshop = Workshop::factory()->forOrganization($org->id)->archived()->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", ['title' => 'Cannot Update'])
        ->assertStatus(422);
});

test('workshop response does not expose join_code on update for non-owner', function () {
    [$user, $org] = makeStaff();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", ['title' => 'Staff Update'])
        ->assertStatus(403);
});

// ─── Tenant boundary ───────────────────────────────────────────────────────────

test('owner cannot update workshop belonging to different organization', function () {
    [$user, $org] = makeOwner();
    $otherWorkshop = Workshop::factory()->create(); // different org

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$otherWorkshop->id}", ['title' => 'Cross-tenant Hack'])
        ->assertStatus(403);
});

test('owner of org A cannot view workshop belonging to org B', function () {
    [$userA, $orgA] = makeOwner();
    [$userB, $orgB] = makeOwner();

    $orgBWorkshop = Workshop::factory()->forOrganization($orgB->id)->create();

    // userA is a legitimate owner of orgA but has no relationship to orgB
    $this->actingAs($userA, 'sanctum')
        ->getJson("/api/v1/workshops/{$orgBWorkshop->id}")
        ->assertStatus(403);
});

test('workshop list is tenant-scoped and cannot return other org workshops', function () {
    [$user, $org] = makeOwner();
    $other = Workshop::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/workshops");

    $ids = collect($response->json())->pluck('id')->toArray();
    expect($ids)->not->toContain($other->id);
});
