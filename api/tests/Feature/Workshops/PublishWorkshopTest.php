<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

function makeOwnerWithOrg(): array
{
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    return [$user, $org];
}

test('owner can publish an event_based workshop', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'     => 'draft',
        'title'      => 'Harvest Light',
        'description' => 'An outdoor event.',
        'timezone'   => 'America/Chicago',
        'start_date' => '2026-09-01',
        'end_date'   => '2026-09-03',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(200)
        ->assertJsonPath('status', 'published');

    $this->assertDatabaseHas('workshops', [
        'id'     => $workshop->id,
        'status' => 'published',
    ]);
});

test('publish fails when title is missing', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'draft',
        'title'       => '',
        'description' => 'A description.',
        'timezone'    => 'UTC',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(422)
        ->assertJsonStructure(['message', 'errors'])
        ->assertJsonPath('errors.title.0', 'Workshop title is required before publishing.');
});

test('publish fails when description is missing', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'draft',
        'title'       => 'A Title',
        'description' => '',
        'timezone'    => 'UTC',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(422)
        ->assertJsonPath('errors.description.0', 'Workshop description is required before publishing.');
});

test('publish fails when timezone is missing', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'draft',
        'title'       => 'A Title',
        'description' => 'A description.',
        'timezone'    => '',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(422)
        ->assertJsonPath('errors.timezone.0', 'Workshop timezone is required before publishing.');
});

test('publish fails with multiple errors and each is keyed', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'      => 'draft',
        'title'       => '',
        'description' => '',
        'timezone'    => '',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(422);

    $errors = $response->json('errors');
    expect($errors)->toHaveKey('title');
    expect($errors)->toHaveKey('description');
    expect($errors)->toHaveKey('timezone');
});

test('publish fails when start_date is after end_date', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create([
        'status'     => 'draft',
        'start_date' => '2026-09-05',
        'end_date'   => '2026-09-01',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(422)
        ->assertJsonStructure(['message', 'errors'])
        ->assertJsonPath('errors.start_date.0', 'Workshop start date must be on or before end date.');
});

test('archived workshop cannot be published', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->archived()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(422);
});

test('staff cannot publish a workshop', function () {
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(403);
});

test('owner can archive a published workshop', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->published()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/archive")
        ->assertStatus(200)
        ->assertJsonPath('status', 'archived');
});

test('owner can archive a draft workshop', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->draft()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/archive")
        ->assertStatus(200)
        ->assertJsonPath('status', 'archived');
});

test('publishing is idempotent for already-published workshop', function () {
    [$user, $org] = makeOwnerWithOrg();

    $workshop = Workshop::factory()->eventBased()->forOrganization($org->id)->published()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertStatus(200)
        ->assertJsonPath('status', 'published');
});
