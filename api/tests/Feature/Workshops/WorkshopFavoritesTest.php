<?php

use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopFavorite;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Toggle endpoint ──────────────────────────────────────────────────────────

test('POST workshops/{id}/favorite when not favorited returns favorited=true', function () {
    $user = User::factory()->create();
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'toggle-add',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/favorite");

    $response->assertStatus(200)
        ->assertJsonPath('data.favorited', true)
        ->assertJsonPath('data.workshop_id', $workshop->id);

    $this->assertDatabaseHas('workshop_favorites', [
        'user_id'     => $user->id,
        'workshop_id' => $workshop->id,
    ]);
});

test('POST workshops/{id}/favorite when already favorited returns favorited=false (toggle)', function () {
    $user = User::factory()->create();
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'toggle-remove',
    ]);

    WorkshopFavorite::create([
        'user_id'     => $user->id,
        'workshop_id' => $workshop->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/favorite");

    $response->assertStatus(200)
        ->assertJsonPath('data.favorited', false);

    $this->assertDatabaseMissing('workshop_favorites', [
        'user_id'     => $user->id,
        'workshop_id' => $workshop->id,
    ]);
});

test('POST workshops/{id}/favorite unauthenticated returns 401', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'toggle-unauth',
    ]);

    $this->postJson("/api/v1/workshops/{$workshop->id}/favorite")
        ->assertStatus(401);
});

// ─── GET /me/favorites ────────────────────────────────────────────────────────

test('GET me/favorites returns only the authenticated user\'s favorited workshops', function () {
    $user  = User::factory()->create();
    $other = User::factory()->create();

    $workshopA = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'fav-workshop-a',
    ]);
    $workshopB = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'fav-workshop-b',
    ]);
    $workshopC = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'fav-workshop-c',
    ]);

    // User favorites A and B; other user favorites C
    WorkshopFavorite::create(['user_id' => $user->id, 'workshop_id' => $workshopA->id]);
    WorkshopFavorite::create(['user_id' => $user->id, 'workshop_id' => $workshopB->id]);
    WorkshopFavorite::create(['user_id' => $other->id, 'workshop_id' => $workshopC->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/favorites');

    $response->assertStatus(200);

    $ids = collect($response->json('data'))->pluck('id')->toArray();
    expect($ids)->toContain($workshopA->id);
    expect($ids)->toContain($workshopB->id);
    expect($ids)->not->toContain($workshopC->id);
});

test('GET me/favorites does not return other users\' favorites', function () {
    $user  = User::factory()->create();
    $other = User::factory()->create();

    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'other-user-fav',
    ]);

    WorkshopFavorite::create(['user_id' => $other->id, 'workshop_id' => $workshop->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/favorites');

    $response->assertStatus(200);

    $ids = collect($response->json('data'))->pluck('id')->toArray();
    expect($ids)->not->toContain($workshop->id);
});

// ─── is_favorited on workshop resource ───────────────────────────────────────

test('is_favorited is true on workshop resource when user has favorited it', function () {
    $user = User::factory()->create();
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'is-fav-true',
    ]);

    WorkshopFavorite::create(['user_id' => $user->id, 'workshop_id' => $workshop->id]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/public/workshops/is-fav-true')
        ->assertStatus(200)
        ->assertJsonPath('is_favorited', true);
});

test('is_favorited is false when user has not favorited the workshop', function () {
    $user = User::factory()->create();
    Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'is-fav-false',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/public/workshops/is-fav-false')
        ->assertStatus(200)
        ->assertJsonPath('is_favorited', false);
});

test('is_favorited is false when not authenticated', function () {
    Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'is-fav-unauth',
    ]);

    $this->getJson('/api/v1/public/workshops/is-fav-unauth')
        ->assertStatus(200)
        ->assertJsonPath('is_favorited', false);
});
