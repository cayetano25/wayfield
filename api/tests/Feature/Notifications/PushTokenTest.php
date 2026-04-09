<?php

use App\Models\PushToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Register push token ───────────────────────────────────────────────────────

test('user can register a push token', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/me/push-tokens', [
            'platform' => 'ios',
            'push_token' => 'ExponentPushToken[TestToken001]',
        ])
        ->assertStatus(201)
        ->assertJsonStructure(['id', 'platform', 'push_token', 'is_active', 'last_registered_at']);

    $this->assertDatabaseHas('push_tokens', [
        'user_id' => $user->id,
        'platform' => 'ios',
        'push_token' => 'ExponentPushToken[TestToken001]',
        'is_active' => true,
    ]);
});

// ─── Re-register same token updates last_registered_at ────────────────────────

test('re-registering the same token updates last_registered_at and returns 200', function () {
    $user = User::factory()->create();

    $token = PushToken::factory()->forUser($user->id)->create([
        'push_token' => 'ExponentPushToken[Reregister]',
        'platform' => 'android',
        'last_registered_at' => now()->subDay(),
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/me/push-tokens', [
            'platform' => 'android',
            'push_token' => 'ExponentPushToken[Reregister]',
        ])
        ->assertStatus(200);

    $this->assertTrue($token->fresh()->last_registered_at->isToday());
});

// ─── Deactivate push token ─────────────────────────────────────────────────────

test('user can deactivate their push token', function () {
    $user = User::factory()->create();
    $token = PushToken::factory()->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/me/push-tokens/{$token->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('push_tokens', [
        'id' => $token->id,
        'is_active' => false,
    ]);
});

// ─── Cannot deactivate another user's token ───────────────────────────────────

test('user cannot deactivate another users push token', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $token = PushToken::factory()->forUser($otherUser->id)->create();

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/me/push-tokens/{$token->id}")
        ->assertStatus(403);

    $this->assertDatabaseHas('push_tokens', [
        'id' => $token->id,
        'is_active' => true,
    ]);
});

// ─── Platform validation ───────────────────────────────────────────────────────

test('push token registration rejects invalid platform', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/me/push-tokens', [
            'platform' => 'windows',
            'push_token' => 'SomeToken',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['platform']);
});
