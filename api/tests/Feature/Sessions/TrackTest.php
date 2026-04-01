<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Track;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

function makeWorkshopOwner(): array
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

test('owner can create a track', function () {
    [$user, $org, $workshop] = makeWorkshopOwner();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/tracks", [
            'title'      => 'Landscape Track',
            'sort_order' => 1,
        ])
        ->assertStatus(201)
        ->assertJsonPath('title', 'Landscape Track')
        ->assertJsonPath('workshop_id', $workshop->id);
});

test('owner can list tracks for a workshop', function () {
    [$user, $org, $workshop] = makeWorkshopOwner();

    Track::factory()->forWorkshop($workshop->id)->create(['title' => 'Track A']);
    Track::factory()->forWorkshop($workshop->id)->create(['title' => 'Track B']);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/tracks")
        ->assertStatus(200);

    expect($response->json())->toHaveCount(2);
});

test('owner can update a track', function () {
    [$user, $org, $workshop] = makeWorkshopOwner();

    $track = Track::factory()->forWorkshop($workshop->id)->create(['title' => 'Old Title']);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/tracks/{$track->id}", ['title' => 'New Title'])
        ->assertStatus(200)
        ->assertJsonPath('title', 'New Title');
});

test('owner can delete a track', function () {
    [$user, $org, $workshop] = makeWorkshopOwner();

    $track = Track::factory()->forWorkshop($workshop->id)->create();

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/tracks/{$track->id}")
        ->assertStatus(204);

    $this->assertDatabaseMissing('tracks', ['id' => $track->id]);
});

test('non-member cannot create a track', function () {
    $outsider = User::factory()->create();
    [,, $workshop] = makeWorkshopOwner();

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/tracks", ['title' => 'Hack'])
        ->assertStatus(403);
});

test('track list is ordered by sort_order', function () {
    [$user,, $workshop] = makeWorkshopOwner();

    Track::factory()->forWorkshop($workshop->id)->create(['title' => 'C', 'sort_order' => 3]);
    Track::factory()->forWorkshop($workshop->id)->create(['title' => 'A', 'sort_order' => 1]);
    Track::factory()->forWorkshop($workshop->id)->create(['title' => 'B', 'sort_order' => 2]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/tracks")
        ->assertStatus(200);

    $titles = collect($response->json())->pluck('title');
    expect($titles->first())->toBe('A');
    expect($titles->last())->toBe('C');
});
