<?php

use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('forgot password queues reset email for known address', function () {
    Mail::fake();

    $user = User::factory()->create(['email' => 'user@example.com']);

    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'user@example.com'])
        ->assertStatus(200);

    Mail::assertQueued(PasswordResetMail::class, function ($mail) {
        return $mail->hasTo('user@example.com');
    });
});

test('forgot password succeeds silently for unknown email (no enumeration)', function () {
    Mail::fake();

    $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])
        ->assertStatus(200);

    Mail::assertNothingQueued();
});

test('user can reset password with valid token', function () {
    $user = User::factory()->create(['email' => 'user@example.com']);

    $token = \Illuminate\Support\Str::random(64);
    DB::table('password_reset_tokens')->insert([
        'email'      => $user->email,
        'token_hash' => hash('sha256', $token),
        'expires_at' => now()->addHour()->toDateTimeString(),
        'created_at' => now()->toDateTimeString(),
    ]);

    $this->postJson('/api/v1/auth/reset-password', [
        'email'                 => $user->email,
        'token'                 => $token,
        'password'              => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(200);

    $this->assertTrue(Hash::check('newpassword123', $user->fresh()->password_hash));
});

test('reset password fails with invalid token', function () {
    $user = User::factory()->create(['email' => 'user@example.com']);

    DB::table('password_reset_tokens')->insert([
        'email'      => $user->email,
        'token_hash' => hash('sha256', 'valid-token'),
        'expires_at' => now()->addHour()->toDateTimeString(),
        'created_at' => now()->toDateTimeString(),
    ]);

    $this->postJson('/api/v1/auth/reset-password', [
        'email'                 => $user->email,
        'token'                 => 'wrong-token',
        'password'              => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(422);
});

test('reset password fails with expired token', function () {
    $user = User::factory()->create(['email' => 'user@example.com']);

    $token = \Illuminate\Support\Str::random(64);
    DB::table('password_reset_tokens')->insert([
        'email'      => $user->email,
        'token_hash' => hash('sha256', $token),
        'expires_at' => now()->subHour()->toDateTimeString(),
        'created_at' => now()->subHours(2)->toDateTimeString(),
    ]);

    $this->postJson('/api/v1/auth/reset-password', [
        'email'                 => $user->email,
        'token'                 => $token,
        'password'              => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(422);
});

test('reset password revokes all existing tokens', function () {
    $user = User::factory()->create(['email' => 'user@example.com']);
    $existingToken = $user->createToken('old-session')->plainTextToken;

    $token = \Illuminate\Support\Str::random(64);
    DB::table('password_reset_tokens')->insert([
        'email'      => $user->email,
        'token_hash' => hash('sha256', $token),
        'expires_at' => now()->addHour()->toDateTimeString(),
        'created_at' => now()->toDateTimeString(),
    ]);

    $this->postJson('/api/v1/auth/reset-password', [
        'email'                 => $user->email,
        'token'                 => $token,
        'password'              => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ])->assertStatus(200);

    $this->withToken($existingToken)
        ->getJson('/api/v1/me')
        ->assertStatus(401);
});
