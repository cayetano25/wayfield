<?php

use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('GET /me returns authenticated user with first_name and last_name', function () {
    $user = User::factory()->create([
        'first_name' => 'Alice',
        'last_name'  => 'Smith',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me')
        ->assertStatus(200)
        ->assertJsonPath('first_name', 'Alice')
        ->assertJsonPath('last_name', 'Smith')
        ->assertJsonMissing(['password_hash', 'password']);
});

test('PATCH /me updates first_name and last_name', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/me', [
            'first_name' => 'Updated',
            'last_name'  => 'Name',
        ])
        ->assertStatus(200)
        ->assertJsonPath('first_name', 'Updated')
        ->assertJsonPath('last_name', 'Name');

    $this->assertDatabaseHas('users', [
        'id'         => $user->id,
        'first_name' => 'Updated',
        'last_name'  => 'Name',
    ]);
});

test('PATCH /me cannot set first_name to empty string', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/me', ['first_name' => ''])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['first_name']);
});

test('GET /me requires authentication', function () {
    $this->getJson('/api/v1/me')->assertStatus(401);
});
