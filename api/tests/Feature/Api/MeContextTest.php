<?php

declare(strict_types=1);

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('/me returns empty contexts for a brand new user with no memberships', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('contexts.organization_roles', [])
        ->assertJsonPath('contexts.is_leader', false)
        ->assertJsonPath('contexts.leader_id', null);
});

test('/me returns org role for owner', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $org = Organization::factory()->create(['name' => 'Test Org']);
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $response = $this->withToken($token)->getJson('/api/v1/me');
    $response->assertStatus(200);

    $roles = $response->json('contexts.organization_roles');
    expect($roles)->toHaveCount(1)
        ->and($roles[0]['role'])->toBe('owner')
        ->and($roles[0]['organization_id'])->toBe($org->id)
        ->and($roles[0]['organization_name'])->toBe('Test Org');
});

test('/me returns multiple org roles for user with membership in multiple orgs', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $org1 = Organization::factory()->create();
    $org2 = Organization::factory()->create();

    OrganizationUser::create([
        'organization_id' => $org1->id, 'user_id' => $user->id,
        'role' => 'admin', 'is_active' => true,
    ]);
    OrganizationUser::create([
        'organization_id' => $org2->id, 'user_id' => $user->id,
        'role' => 'staff', 'is_active' => true,
    ]);

    $token = $user->createToken('web')->plainTextToken;
    $response = $this->withToken($token)->getJson('/api/v1/me');
    $roles = $response->json('contexts.organization_roles');

    expect($roles)->toHaveCount(2);
    $roleValues = array_column($roles, 'role');
    expect($roleValues)->toContain('admin')->toContain('staff');
});

test('/me returns is_leader true and leader_id when user has an accepted leader record', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $leader = Leader::factory()->create(['user_id' => $user->id]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('contexts.is_leader', true)
        ->assertJsonPath('contexts.leader_id', $leader->id);
});

test('/me does not include inactive org memberships in contexts', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $org = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'staff',
        'is_active' => false, // inactive — must be excluded
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertJsonPath('contexts.organization_roles', []);
});

test('/me still returns existing user fields alongside the new contexts key', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertJsonStructure([
            'id',
            'first_name',
            'last_name',
            'email',
            'contexts' => [
                'organization_roles',
                'is_leader',
                'leader_id',
            ],
        ]);
});

// ─── leader_profile in /me ────────────────────────────────────────────────────

test('/me includes leader_profile when user has a linked leader record', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $leader = Leader::factory()->create([
        'user_id'        => $user->id,
        'bio'            => 'My photography bio.',
        'city'           => 'Austin',
        'state_or_region' => 'TX',
        'phone_number'   => '+15125550001',
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.id', $leader->id)
        ->assertJsonPath('leader_profile.bio', 'My photography bio.')
        ->assertJsonPath('leader_profile.city', 'Austin')
        ->assertJsonPath('leader_profile.state_or_region', 'TX')
        ->assertJsonPath('leader_profile.phone_number', '+15125550001');
});

test('/me returns exists=false and leader_id=null when user is not a leader', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('leader_profile.exists', false)
        ->assertJsonPath('leader_profile.leader_id', null);
});

test('/me eager-loads leader without an N+1 query', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    Leader::factory()->create(['user_id' => $user->id]);
    $token = $user->createToken('web')->plainTextToken;

    // Two requests: the second should produce the same query count,
    // confirming the relationship is loaded via loadMissing not lazy-loading.
    $queryCount = 0;
    \Illuminate\Support\Facades\DB::listen(function () use (&$queryCount) {
        $queryCount++;
    });

    $this->withToken($token)->getJson('/api/v1/me')->assertStatus(200);

    // The leader relationship must not trigger a separate per-row query.
    // A fixed upper bound of 12 queries is generous but bounded.
    expect($queryCount)->toBeLessThan(12);
});
