<?php

use App\Mail\EmailVerificationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

test('user can register with first_name, last_name, email, and password', function () {
    Mail::fake();

    $response = $this->postJson('/api/v1/auth/register', [
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ]);

    $response->assertStatus(201)
        ->assertJsonPath('user.first_name', 'Jane')
        ->assertJsonPath('user.last_name', 'Doe')
        ->assertJsonPath('user.email', 'jane@example.com')
        ->assertJsonMissing(['password_hash']);

    $this->assertDatabaseHas('users', [
        'email' => 'jane@example.com',
        'first_name' => 'Jane',
        'last_name' => 'Doe',
    ]);

    $this->assertDatabaseHas('auth_methods', [
        'provider' => 'email',
        'provider_email' => 'jane@example.com',
    ]);
});

test('registration requires first_name', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'last_name' => 'Doe',
        'email' => 'jane@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['first_name']);
});

test('registration requires last_name', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'first_name' => 'Jane',
        'email' => 'jane@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['last_name']);
});

test('registration rejects duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $response = $this->postJson('/api/v1/auth/register', [
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'taken@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('verification email is queued on registration', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/register', [
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ]);

    Mail::assertQueued(EmailVerificationMail::class, function ($mail) {
        return $mail->hasTo('jane@example.com');
    });
});

test('password_hash is never exposed in response', function () {
    Mail::fake();

    $response = $this->postJson('/api/v1/auth/register', [
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ]);

    $response->assertJsonMissing(['password_hash', 'password']);
});
