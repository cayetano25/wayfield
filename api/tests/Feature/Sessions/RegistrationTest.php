<?php

use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('participant can join a published workshop by join code', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'TESTCODE']);
    $user     = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'TESTCODE'])
        ->assertStatus(201)
        ->assertJsonPath('registration_status', 'registered');

    $this->assertDatabaseHas('registrations', [
        'workshop_id'         => $workshop->id,
        'user_id'             => $user->id,
        'registration_status' => 'registered',
    ]);
});

test('joining with an invalid join code returns 404', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'INVALID1'])
        ->assertStatus(404);
});

test('joining a draft workshop returns 404', function () {
    Workshop::factory()->draft()->create(['join_code' => 'DRAFT001']);
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'DRAFT001'])
        ->assertStatus(404);
});

test('joining the same workshop twice returns the existing registration', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'DUPE0001']);
    $user     = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'DUPE0001'])
        ->assertStatus(201);

    // Second join returns 200 with the existing registration — no duplicate row.
    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'DUPE0001'])
        ->assertStatus(200)
        ->assertJsonPath('registration_status', 'registered');

    $this->assertEquals(
        1,
        Registration::where('workshop_id', $workshop->id)->where('user_id', $user->id)->count()
    );
});

test('participant can view their own registration', function () {
    $workshop = Workshop::factory()->published()->create();
    $user     = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/registration")
        ->assertStatus(200)
        ->assertJsonPath('workshop_id', $workshop->id)
        ->assertJsonPath('registration_status', 'registered');
});

test('unauthenticated user gets 404 for missing registration', function () {
    $workshop = Workshop::factory()->published()->create();
    $user     = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/registration")
        ->assertStatus(404);
});

test('participant can cancel their registration', function () {
    $workshop = Workshop::factory()->published()->create();
    $user     = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/registration")
        ->assertStatus(204);

    $this->assertDatabaseHas('registrations', [
        'workshop_id'         => $workshop->id,
        'user_id'             => $user->id,
        'registration_status' => 'canceled',
    ]);
});

test('join code is case-insensitive', function () {
    $workshop = Workshop::factory()->published()->create(['join_code' => 'ABCD1234']);
    $user     = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/workshops/join', ['join_code' => 'abcd1234'])
        ->assertStatus(201);
});
