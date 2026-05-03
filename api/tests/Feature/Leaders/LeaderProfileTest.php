<?php

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Leader self-profile ──────────────────────────────────────────────────────

test('leader can retrieve their own profile', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/profile')
        ->assertStatus(200)
        ->assertJsonPath('id', $leader->id)
        ->assertJsonPath('first_name', $leader->first_name)
        ->assertJsonPath('last_name', $leader->last_name);
});

test('user without leader profile gets 404', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/profile')
        ->assertStatus(404);
});

test('leader can update their own profile', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    // city is no longer accepted on this endpoint (Phase 16 — update via PATCH /api/v1/me)
    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'bio' => 'Updated bio.',
            'website_url' => 'https://example.com',
        ])
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.bio', 'Updated bio.')
        ->assertJsonPath('leader_profile.website_url', 'https://example.com');

    $this->assertDatabaseHas('leaders', [
        'id' => $leader->id,
        'bio' => 'Updated bio.',
        'website_url' => 'https://example.com',
    ]);
});

test('leader cannot update another leader\'s profile', function () {
    $user1 = User::factory()->create();
    $leader1 = Leader::factory()->withUser($user1->id)->create();

    $user2 = User::factory()->create();
    Leader::factory()->withUser($user2->id)->create();

    // user2 tries to update leader1's profile — must be rejected
    $this->actingAs($user2, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'bio' => 'Malicious update.',
        ])
        ->assertStatus(200);

    // leader1's bio must not change
    $leader1->refresh();
    expect($leader1->bio)->not->toBe('Malicious update.');
});

test('profile update is logged to audit_logs', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'bio' => 'New bio.',
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $user->id,
        'entity_type' => 'leader',
        'entity_id' => $leader->id,
        'action' => 'leader_profile_updated',
    ]);
});

test('leader can view their assigned sessions', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertStatus(200);

    expect($response->json())->toHaveCount(1);
    expect($response->json()[0]['id'])->toBe($session->id);
});

test('leader sees only their assigned sessions, not others', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();

    $assignedSession = Session::factory()->forWorkshop($workshop->id)->published()->create();
    $unassignedSession = Session::factory()->forWorkshop($workshop->id)->published()->create();

    SessionLeader::factory()->create([
        'session_id' => $assignedSession->id,
        'leader_id' => $leader->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/sessions')
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id')->toArray();
    expect($ids)->toContain($assignedSession->id);
    expect($ids)->not->toContain($unassignedSession->id);
});

// ─── Acceptance criterion 7: organizer cannot update another user's leader profile ─

test('organizer without a linked leader record cannot update any leader profile', function () {
    // An org admin who has never accepted a leader invitation has no linked
    // Leader record. The profile endpoint resolves the leader by the authenticated
    // user's user_id — so they get 404, not someone else's profile.
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    // A separate leader exists in this org — organizer must NOT be able to reach it
    $leader = Leader::factory()->create();
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->patchJson('/api/v1/leader/profile', ['bio' => 'Injected bio.'])
        ->assertStatus(404);

    // The other leader's bio must be unchanged
    $leader->refresh();
    expect($leader->bio)->not->toBe('Injected bio.');
});

test('organizer with their own leader profile can only update their own, not another leader', function () {
    // Even when the org admin happens to also be a leader, the profile endpoint
    // is bound to their own user_id — they cannot reach a different leader's profile.
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    // Admin is also a leader
    $adminLeader = Leader::factory()->withUser($admin->id)->create(['bio' => 'Admin bio.']);

    // A separate unrelated leader
    $otherLeader = Leader::factory()->create(['bio' => 'Other bio.']);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $otherLeader->id,
    ]);

    // The PATCH /leader/profile endpoint always resolves to the authenticated user's own leader
    $this->actingAs($admin, 'sanctum')
        ->patchJson('/api/v1/leader/profile', ['bio' => 'Updated.'])
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.id', $adminLeader->id); // only their own leader returned

    // Other leader's bio must be completely unchanged
    $otherLeader->refresh();
    expect($otherLeader->bio)->toBe('Other bio.');
});

// ─── Organizer cannot update leader profile fields ────────────────────────────

test('organizer with no linked leader record cannot submit bio to profile endpoint', function () {
    // The self-profile endpoint resolves by user_id. An organizer who has never
    // accepted a leader invitation has no linked leader record — they get 404.
    // This is the primary protection: the endpoint is structurally inaccessible.
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $targetLeader = Leader::factory()->create(['bio' => 'Original bio.']);
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $targetLeader->id,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->patchJson('/api/v1/leader/profile', ['bio' => 'Injected bio.', 'phone_number' => '555-0000'])
        ->assertStatus(404);

    $targetLeader->refresh();
    expect($targetLeader->bio)->toBe('Original bio.');
});

test('organizer with a linked leader record can only update their own, not another leader bio', function () {
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $adminLeader = Leader::factory()->withUser($admin->id)->create(['bio' => 'Admin bio.']);
    $otherLeader = Leader::factory()->create(['bio' => 'Other bio.', 'phone_number' => '555-1111']);

    // Submitting bio/phone goes to the admin's own leader record, not the other leader
    $this->actingAs($admin, 'sanctum')
        ->patchJson('/api/v1/leader/profile', ['bio' => 'Updated admin bio.', 'phone_number' => '555-9999'])
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.id', $adminLeader->id);

    $otherLeader->refresh();
    expect($otherLeader->bio)->toBe('Other bio.');
    expect($otherLeader->phone_number)->toBe('555-1111');
});

test('session assignment PATCH does not accept leader profile fields', function () {
    // PATCH /api/v1/sessions/{session}/leaders/{leader} only accepts assignment_status.
    // Sending profile fields in the body must not alter the leader record.
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    $session = Session::factory()->forWorkshop($workshop->id)->create();
    $leader = Leader::factory()->create(['bio' => 'Original bio.', 'phone_number' => '555-2222']);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'pending',
    ]);

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}/leaders/{$leader->id}", [
            'assignment_status' => 'accepted',
            'bio' => 'Injected bio.',
            'phone_number' => '555-0000',
        ])
        ->assertStatus(200);

    $leader->refresh();
    expect($leader->bio)->toBe('Original bio.');
    expect($leader->phone_number)->toBe('555-2222');
});

// ─── Organizer leaders list ───────────────────────────────────────────────────

test('organizer can view org leaders list', function () {
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $leader = Leader::factory()->create();
    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/leaders")
        ->assertStatus(200);

    expect($response->json())->toHaveCount(1);
});
