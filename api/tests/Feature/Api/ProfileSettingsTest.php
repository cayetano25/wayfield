<?php

declare(strict_types=1);

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── GET /me response shape ──────────────────────────────────────────────────

test('GET /me includes photo_url and avatar_initials', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'profile_image_url' => 'https://example.com/photo.jpg',
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('photo_url', 'https://example.com/photo.jpg')
        ->assertJsonPath('avatar_initials', 'JD');
});

test('GET /me photo_url is null when no profile image', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'profile_image_url' => null,
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('photo_url', null);
});

test('GET /me includes pronouns', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'pronouns' => 'they/them',
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('pronouns', 'they/them');
});

// ─── PATCH /me pronouns ──────────────────────────────────────────────────────

test('PATCH /me updates pronouns', function () {
    $user = User::factory()->create(['email_verified_at' => now(), 'pronouns' => null]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->patchJson('/api/v1/me', ['pronouns' => 'she/her'])
        ->assertStatus(200)
        ->assertJsonPath('pronouns', 'she/her');

    expect($user->fresh()->pronouns)->toBe('she/her');
});

test('PATCH /me clears pronouns with null', function () {
    $user = User::factory()->create(['email_verified_at' => now(), 'pronouns' => 'he/him']);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->patchJson('/api/v1/me', ['pronouns' => null])
        ->assertStatus(200)
        ->assertJsonPath('pronouns', null);

    expect($user->fresh()->pronouns)->toBeNull();
});

test('PATCH /me rejects pronouns longer than 50 characters', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->patchJson('/api/v1/me', ['pronouns' => str_repeat('x', 51)])
        ->assertStatus(422)
        ->assertJsonPath('errors.pronouns.0', fn ($v) => str_contains($v, '50'));
});

// ─── DELETE /me/photo ────────────────────────────────────────────────────────

test('DELETE /me/photo clears profile_image_url', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'profile_image_url' => 'https://example.com/photo.jpg',
    ]);
    $token = $user->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->deleteJson('/api/v1/me/photo')
        ->assertStatus(200)
        ->assertJsonPath('message', 'Photo removed.');

    expect($user->fresh()->profile_image_url)->toBeNull();
});

test('DELETE /me/photo requires authentication', function () {
    $this->deleteJson('/api/v1/me/photo')
        ->assertStatus(401);
});

// ─── PublicLeaderResource photo fallback ────────────────────────────────────

test('PublicLeaderResource prefers user profile_image_url over leader photo', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'profile_image_url' => 'https://example.com/user-photo.jpg',
    ]);
    $org = Organization::factory()->create(['status' => 'active']);
    $leader = Leader::factory()->create([
        'user_id' => $user->id,
        'profile_image_url' => 'https://example.com/leader-photo.jpg',
        'slug' => 'test-leader',
    ]);
    OrganizationLeader::create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);

    $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200)
        ->assertJsonPath('profile_image_url', 'https://example.com/user-photo.jpg');
});

test('PublicLeaderResource falls back to leader photo when user has no photo', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'profile_image_url' => null,
    ]);
    $org = Organization::factory()->create(['status' => 'active']);
    $leader = Leader::factory()->create([
        'user_id' => $user->id,
        'profile_image_url' => 'https://example.com/leader-photo.jpg',
        'slug' => 'test-leader-2',
    ]);
    OrganizationLeader::create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);

    $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200)
        ->assertJsonPath('profile_image_url', 'https://example.com/leader-photo.jpg');
});

// ─── PublicLeaderResource formatted_location ─────────────────────────────────

test('PublicLeaderResource includes formatted_location from leader city/state', function () {
    $org = Organization::factory()->create(['status' => 'active']);
    $leader = Leader::factory()->create([
        'user_id' => null,
        'city' => 'Denver',
        'state_or_region' => 'CO',
        'slug' => 'test-leader-3',
    ]);
    OrganizationLeader::create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);

    $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200)
        ->assertJsonPath('formatted_location', 'Denver, CO');
});

test('PublicLeaderResource formatted_location is null when no location data', function () {
    $org = Organization::factory()->create(['status' => 'active']);
    $leader = Leader::factory()->create([
        'user_id' => null,
        'city' => null,
        'state_or_region' => null,
        'slug' => 'test-leader-4',
    ]);
    OrganizationLeader::create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'active',
    ]);

    $this->getJson("/api/v1/public/leaders/{$leader->slug}")
        ->assertStatus(200)
        ->assertJsonPath('formatted_location', null);
});
