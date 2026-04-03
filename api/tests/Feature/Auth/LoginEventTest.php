<?php

use App\Models\LoginEvent;
use App\Models\User;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('successful login creates a login_event record with outcome=success', function () {
    $user = User::factory()->create([
        'email'        => 'test@example.com',
        'password_hash' => bcrypt('password123'),
        'is_active'    => true,
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => 'test@example.com',
        'password' => 'password123',
    ])->assertStatus(200);

    $this->assertDatabaseHas('login_events', [
        'user_id'         => $user->id,
        'email_attempted' => 'test@example.com',
        'outcome'         => 'success',
    ]);
});

test('failed login with wrong password creates a login_event with outcome=failed', function () {
    $user = User::factory()->create([
        'email'         => 'test@example.com',
        'password_hash' => bcrypt('correct-password'),
        'is_active'     => true,
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => 'test@example.com',
        'password' => 'wrong-password',
    ])->assertStatus(401);

    $this->assertDatabaseHas('login_events', [
        'user_id'         => $user->id,
        'email_attempted' => 'test@example.com',
        'outcome'         => 'failed',
    ]);
});

test('login attempt for unknown email creates a login_event with null user_id', function () {
    $this->postJson('/api/v1/auth/login', [
        'email'    => 'nobody@example.com',
        'password' => 'irrelevant',
    ])->assertStatus(401);

    $this->assertDatabaseHas('login_events', [
        'user_id'         => null,
        'email_attempted' => 'nobody@example.com',
        'outcome'         => 'failed',
    ]);
});

test('inactive account login attempt is recorded with outcome=inactive', function () {
    User::factory()->create([
        'email'         => 'inactive@example.com',
        'password_hash' => bcrypt('password'),
        'is_active'     => false,
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => 'inactive@example.com',
        'password' => 'password',
    ])->assertStatus(401);

    $this->assertDatabaseHas('login_events', [
        'email_attempted' => 'inactive@example.com',
        'outcome'         => 'inactive',
    ]);
});

test('unverified account login attempt is recorded with outcome=unverified', function () {
    User::factory()->unverified()->create([
        'email'         => 'unverified@example.com',
        'password_hash' => bcrypt('password'),
        'is_active'     => true,
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => 'unverified@example.com',
        'password' => 'password',
    ])->assertStatus(401);

    $this->assertDatabaseHas('login_events', [
        'email_attempted' => 'unverified@example.com',
        'outcome'         => 'unverified',
    ]);
});

test('login_events table has no updated_at column — record is immutable', function () {
    User::factory()->create([
        'email'         => 'audit@example.com',
        'password_hash' => bcrypt('password'),
        'is_active'     => true,
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email'    => 'audit@example.com',
        'password' => 'password',
    ])->assertStatus(200);

    $event = LoginEvent::where('email_attempted', 'audit@example.com')->first();
    expect($event)->not->toBeNull();

    // UPDATED_AT = null means the model never writes updated_at
    expect(\Illuminate\Support\Facades\Schema::hasColumn('login_events', 'updated_at'))->toBeFalse();
});
