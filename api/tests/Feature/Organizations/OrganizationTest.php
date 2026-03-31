<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Subscription;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('authenticated user can create an organization', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/organizations', [
            'name'                       => 'Acme Photography',
            'primary_contact_first_name' => 'John',
            'primary_contact_last_name'  => 'Smith',
            'primary_contact_email'      => 'john@acme.com',
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('name', 'Acme Photography');

    $organization = Organization::where('name', 'Acme Photography')->first();
    $this->assertNotNull($organization);

    // Creator becomes owner
    $this->assertDatabaseHas('organization_users', [
        'organization_id' => $organization->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    // Free subscription created
    $this->assertDatabaseHas('subscriptions', [
        'organization_id' => $organization->id,
        'plan_code'       => 'free',
        'status'          => 'active',
    ]);
});

test('organization requires primary contact first and last name', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/organizations', [
            'name'                  => 'Acme Photography',
            'primary_contact_email' => 'john@acme.com',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors([
            'primary_contact_first_name',
            'primary_contact_last_name',
        ]);
});

test('owner can update organization', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/organizations/{$organization->id}", [
            'name' => 'Updated Name',
        ])
        ->assertStatus(200)
        ->assertJsonPath('name', 'Updated Name');
});

test('non-member cannot view organization', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$organization->id}")
        ->assertStatus(403);
});

test('staff cannot update organization metadata', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id'         => $user->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/organizations/{$organization->id}", [
            'name' => 'Staff Attempt',
        ])
        ->assertStatus(403);
});
