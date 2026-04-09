<?php

use App\Models\Location;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function locationOwner(): array
{
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    return [$user, $org];
}

test('owner can create a location for their organization', function () {
    [$user, $org] = locationOwner();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/locations", [
            'name' => 'Studio A',
            'address_line_1' => '456 Canyon Blvd',
            'city' => 'Denver',
            'state_or_region' => 'CO',
            'postal_code' => '80202',
            'country' => 'US',
        ])
        ->assertStatus(201)
        ->assertJsonPath('name', 'Studio A')
        ->assertJsonPath('city', 'Denver');

    $this->assertDatabaseHas('locations', [
        'organization_id' => $org->id,
        'name' => 'Studio A',
    ]);
});

test('owner can list organization locations', function () {
    [$user, $org] = locationOwner();

    Location::factory()->create(['organization_id' => $org->id, 'name' => 'Loc A']);
    Location::factory()->create(['organization_id' => $org->id, 'name' => 'Loc B']);
    Location::factory()->create(); // different org, should not appear

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/locations")
        ->assertStatus(200);

    expect(count($response->json()))->toBe(2);
});

test('owner can update a location', function () {
    [$user, $org] = locationOwner();

    $location = Location::factory()->create(['organization_id' => $org->id]);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/locations/{$location->id}", ['name' => 'Renamed Venue'])
        ->assertStatus(200)
        ->assertJsonPath('name', 'Renamed Venue');
});

test('owner can delete a location', function () {
    [$user, $org] = locationOwner();

    $location = Location::factory()->create(['organization_id' => $org->id]);

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/locations/{$location->id}")
        ->assertStatus(204);

    $this->assertDatabaseMissing('locations', ['id' => $location->id]);
});

test('non-member cannot list locations for an organization', function () {
    $outsider = User::factory()->create();
    $org = Organization::factory()->create();

    $this->actingAs($outsider, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/locations")
        ->assertStatus(403);
});

test('owner cannot update location belonging to another organization', function () {
    [$user, $org] = locationOwner();
    $otherLocation = Location::factory()->create(); // different org

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/locations/{$otherLocation->id}", ['name' => 'Hack'])
        ->assertStatus(403);
});
