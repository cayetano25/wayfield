<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('user cannot view organization they do not belong to', function () {
    $user = User::factory()->create();
    $otherOrg = Organization::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$otherOrg->id}")
        ->assertStatus(403);
});

test('user cannot update organization they do not belong to', function () {
    $user = User::factory()->create();
    $otherOrg = Organization::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/organizations/{$otherOrg->id}", ['name' => 'Hijacked'])
        ->assertStatus(403);
});

test('user cannot add members to organization they do not belong to', function () {
    $user = User::factory()->create();
    $otherOrg = Organization::factory()->create();
    $targetUser = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$otherOrg->id}/users", [
            'user_id' => $targetUser->id,
            'role' => 'staff',
        ])
        ->assertStatus(403);
});

test('index only returns organizations the authenticated user belongs to', function () {
    $user = User::factory()->create();
    $myOrg = Organization::factory()->create();
    $otherOrg = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $myOrg->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/organizations')
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id');
    expect($ids)->toContain($myOrg->id)
        ->not->toContain($otherOrg->id);
});

test('members endpoint only returns members of the requested organization', function () {
    $user = User::factory()->create();
    $myOrg = Organization::factory()->create();
    $otherOrg = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $myOrg->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $otherMember = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $otherOrg->id,
        'user_id' => $otherMember->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$myOrg->id}/users")
        ->assertStatus(200);

    $userIds = collect($response->json())->pluck('user_id');
    expect($userIds)->not->toContain($otherMember->id);
});
