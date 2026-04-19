<?php

use App\Mail\EmailVerificationMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validRegistrationPayload(array $overrides = []): array
{
    return array_merge([
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane@example.com',
        'password' => 'Password1!',
        'password_confirmation' => 'Password1!',
    ], $overrides);
}

// ─── Happy path ───────────────────────────────────────────────────────────────

test('user can register with valid data', function () {
    Mail::fake();

    $response = $this->postJson('/api/v1/auth/register', validRegistrationPayload());

    $response->assertStatus(201)
        ->assertJsonPath('user.first_name', 'Jane')
        ->assertJsonPath('user.last_name', 'Doe')
        ->assertJsonPath('user.email', 'jane@example.com');

    $user = User::where('email', 'jane@example.com')->firstOrFail();

    // users row created
    $this->assertDatabaseHas('users', ['email' => 'jane@example.com', 'first_name' => 'Jane']);

    // auth_methods row created with provider = email
    $this->assertDatabaseHas('auth_methods', [
        'user_id' => $user->id,
        'provider' => 'email',
        'provider_email' => 'jane@example.com',
    ]);

    // user_profiles row created
    $this->assertDatabaseHas('user_profiles', ['user_id' => $user->id]);

    // audit log written
    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $user->id,
        'entity_type' => 'user',
        'action' => 'user.registered',
    ]);
});

test('registration fails without first_name', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/register', validRegistrationPayload(['first_name' => '']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['first_name']);
});

test('registration fails without last_name', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/register', validRegistrationPayload(['last_name' => '']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['last_name']);
});

test('registration fails with invalid email', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationPayload(['email' => 'not-an-email']))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

test('registration fails with duplicate email', function () {
    Mail::fake();
    User::factory()->create(['email' => 'taken@example.com']);

    $this->postJson('/api/v1/auth/register', validRegistrationPayload(['email' => 'taken@example.com']))
        ->assertStatus(422)
        ->assertJsonPath('errors.email.0', 'An account with this email already exists. Try signing in instead.');
});

test('registration fails when password lacks uppercase', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationPayload([
        'password' => 'password1!',
        'password_confirmation' => 'password1!',
    ]))->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});

test('registration fails when password lacks numbers', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationPayload([
        'password' => 'Password!',
        'password_confirmation' => 'Password!',
    ]))->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});

test('registration fails when password_confirmation does not match', function () {
    $this->postJson('/api/v1/auth/register', validRegistrationPayload([
        'password' => 'Password1!',
        'password_confirmation' => 'WrongPass2!',
    ]))->assertStatus(422)
        ->assertJsonValidationErrors(['password']);
});

test('registered user has onboarding_completed_at null', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/register', validRegistrationPayload())->assertStatus(201);

    $user = User::where('email', 'jane@example.com')->firstOrFail();

    expect($user->hasCompletedOnboarding())->toBeFalse();
    expect($user->onboarding_completed_at)->toBeNull();
});

test('registration response does not include password or password_hash', function () {
    Mail::fake();

    $response = $this->postJson('/api/v1/auth/register', validRegistrationPayload());

    $response->assertJsonMissing(['password_hash', 'password']);
});

test('verification email is queued on registration', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/register', validRegistrationPayload());

    Mail::assertQueued(EmailVerificationMail::class, fn ($mail) => $mail->hasTo('jane@example.com'));
});
