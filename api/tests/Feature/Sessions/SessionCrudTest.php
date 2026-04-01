<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

function ownerWithSessionBasedWorkshop(): array
{
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    return [$user, $org, $workshop];
}

test('owner can create a session', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/sessions", [
            'title'         => 'Morning Shoot',
            'start_at'      => '2026-09-01 08:00:00',
            'end_at'        => '2026-09-01 11:00:00',
            'delivery_type' => 'in_person',
        ])
        ->assertStatus(201)
        ->assertJsonPath('title', 'Morning Shoot')
        ->assertJsonPath('delivery_type', 'in_person')
        ->assertJsonPath('is_published', false);

    // Verify no leader_id field exists on session row
    $this->assertDatabaseMissing('sessions', ['leader_id' => 1]);
});

test('sessions have no leader_id column', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/sessions", [
            'title'         => 'Check for leader_id',
            'start_at'      => '2026-09-01 08:00:00',
            'end_at'        => '2026-09-01 10:00:00',
            'delivery_type' => 'in_person',
        ])
        ->assertStatus(201);

    // leader_id must never be present in the response
    expect($response->json())->not->toHaveKey('leader_id');
});

test('organizer session resource exposes meeting_url', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    $session = Session::factory()->virtual()->forWorkshop($workshop->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200);

    expect($response->json('meeting_url'))->not->toBeNull();
});

test('owner can update a session', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    $session = Session::factory()->forWorkshop($workshop->id)->create(['title' => 'Old Title']);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}", ['title' => 'New Title'])
        ->assertStatus(200)
        ->assertJsonPath('title', 'New Title');
});

test('session end_at must be after start_at', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/sessions", [
            'title'         => 'Bad Times',
            'start_at'      => '2026-09-01 12:00:00',
            'end_at'        => '2026-09-01 09:00:00',
            'delivery_type' => 'in_person',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['end_at']);
});

test('capacity null creates session with unlimited capacity', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/sessions", [
            'title'         => 'Unlimited Session',
            'start_at'      => '2026-09-01 08:00:00',
            'end_at'        => '2026-09-01 10:00:00',
            'delivery_type' => 'in_person',
            'capacity'      => null,
        ])
        ->assertStatus(201);

    expect($response->json('capacity'))->toBeNull();
});

test('non-member cannot create a session', function () {
    $outsider = User::factory()->create();
    [,, $workshop] = ownerWithSessionBasedWorkshop();

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/sessions", [
            'title'         => 'Hack',
            'start_at'      => '2026-09-01 08:00:00',
            'end_at'        => '2026-09-01 10:00:00',
            'delivery_type' => 'in_person',
        ])
        ->assertStatus(403);
});

test('owner can list sessions for a workshop', function () {
    [$user,, $workshop] = ownerWithSessionBasedWorkshop();

    Session::factory()->forWorkshop($workshop->id)->create(['title' => 'Session A']);
    Session::factory()->forWorkshop($workshop->id)->create(['title' => 'Session B']);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/sessions")
        ->assertStatus(200);

    expect($response->json())->toHaveCount(2);
});

test('tenant boundary: owner cannot view sessions from another org workshop', function () {
    [$user,] = ownerWithSessionBasedWorkshop();
    [,, $otherWorkshop] = ownerWithSessionBasedWorkshop();

    $session = Session::factory()->forWorkshop($otherWorkshop->id)->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(403);
});
