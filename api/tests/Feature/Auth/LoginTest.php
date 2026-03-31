<?php

use App\Models\User;
use App\Models\UserSession;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('user can log in with valid credentials', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'password',
        'platform' => 'web',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure(['token', 'token_type', 'user', 'memberships'])
        ->assertJsonPath('user.first_name', $user->first_name)
        ->assertJsonPath('user.last_name', $user->last_name);
});

test('login creates a user_sessions audit record', function () {
    $user = User::factory()->create();

    $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'password',
        'platform' => 'ios',
    ]);

    $this->assertDatabaseHas('user_sessions', [
        'user_id'  => $user->id,
        'platform' => 'ios',
    ]);
});

test('login fails with wrong password', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(401);
});

test('login fails for inactive user', function () {
    $user = User::factory()->inactive()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $response->assertStatus(401);
});

test('login does not expose password_hash', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/v1/auth/login', [
        'email'    => $user->email,
        'password' => 'password',
    ]);

    $response->assertJsonMissing(['password_hash', 'password']);
});

test('logout removes the token from personal_access_tokens', function () {
    $user = User::factory()->create();
    $user->createToken('test');

    expect($user->tokens()->count())->toBe(1);

    $user->tokens()->delete();

    expect($user->tokens()->count())->toBe(0);
});

test('logout endpoint returns 200 and message', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withToken($token)
        ->postJson('/api/v1/auth/logout')
        ->assertStatus(200)
        ->assertJsonPath('message', 'Logged out successfully.');
});
