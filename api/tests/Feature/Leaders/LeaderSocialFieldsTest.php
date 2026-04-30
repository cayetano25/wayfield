<?php

declare(strict_types=1);

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Social fields on leader profile update ───────────────────────────────────

test('leader can save social_instagram via profile update', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'social_instagram' => 'naturephotographer',
        ])
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.social_instagram', 'naturephotographer');

    expect($leader->fresh()->social_instagram)->toBe('naturephotographer');
});

test('leader can save social_twitter via profile update', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'social_twitter' => 'naturephotog',
        ])
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.social_twitter', 'naturephotog');

    expect($leader->fresh()->social_twitter)->toBe('naturephotog');
});

test('leader can update social_instagram and social_twitter together', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'social_instagram' => 'ig_handle',
            'social_twitter'   => 'tw_handle',
        ])
        ->assertStatus(200);

    $fresh = $leader->fresh();
    expect($fresh->social_instagram)->toBe('ig_handle');
    expect($fresh->social_twitter)->toBe('tw_handle');
});

test('social fields are nullable — can be cleared', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create([
        'social_instagram' => 'old_handle',
        'social_twitter'   => 'old_tw',
    ]);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'social_instagram' => null,
            'social_twitter'   => null,
        ])
        ->assertStatus(200);

    $fresh = $leader->fresh();
    expect($fresh->social_instagram)->toBeNull();
    expect($fresh->social_twitter)->toBeNull();
});

test('social_instagram is validated — max 100 characters', function () {
    $user = User::factory()->create();
    Leader::factory()->withUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'social_instagram' => str_repeat('a', 101),
        ])
        ->assertStatus(422);
});

test('unauthenticated request to leader profile returns 401', function () {
    $this->patchJson('/api/v1/leader/profile', ['social_instagram' => 'test'])
        ->assertStatus(401);
});

// ─── PublicLeaderResource includes formatted_location ────────────────────────

test('public leader resource includes formatted_location for US leader', function () {
    $org = Organization::factory()->create();
    $leader = Leader::factory()->create([
        'slug'            => 'portland-leader',
        'city'            => 'Portland',
        'state_or_region' => 'OR',
        'country'         => 'US',
    ]);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);

    $response = $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200);

    expect($response->json('formatted_location'))->toBe('Portland, OR');
});

test('public leader resource includes formatted_location with country for non-US leader', function () {
    $org = Organization::factory()->create();
    $leader = Leader::factory()->create([
        'slug'            => 'reykjavik-leader',
        'city'            => 'Reykjavik',
        'state_or_region' => null,
        'country'         => 'IS',
    ]);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);

    $response = $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200);

    expect($response->json('formatted_location'))->toBe('Reykjavik, Iceland');
});

test('public leader resource includes country_name', function () {
    $org = Organization::factory()->create();
    $leader = Leader::factory()->create([
        'slug'    => 'antarctica-leader',
        'city'    => 'McMurdo Station',
        'country' => 'AQ',
    ]);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);

    $response = $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200);

    expect($response->json('country_name'))->toBe('Antarctica');
});

test('public leader resource formatted_location is null when city is missing', function () {
    $org = Organization::factory()->create();
    $leader = Leader::factory()->create([
        'slug'    => 'no-city-leader',
        'city'    => null,
        'country' => 'US',
    ]);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);

    $response = $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200);

    expect($response->json('formatted_location'))->toBeNull();
});
