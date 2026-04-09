<?php

use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

test('user can verify email with valid link', function () {
    $user = User::factory()->unverified()->create();

    $hash = sha1($user->email);

    $this->getJson("/api/v1/auth/verify-email/{$user->id}/{$hash}")
        ->assertStatus(200);

    $this->assertNotNull($user->fresh()->email_verified_at);
});

test('verification fails with wrong hash', function () {
    $user = User::factory()->unverified()->create();

    $this->getJson("/api/v1/auth/verify-email/{$user->id}/badhash")
        ->assertStatus(403);
});

test('resend verification queues a notification', function () {
    Notification::fake();

    $user = User::factory()->unverified()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/resend-verification')
        ->assertStatus(200);

    Notification::assertSentTo($user, VerifyEmailNotification::class);
});

test('resend verification returns 422 if already verified', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/auth/resend-verification')
        ->assertStatus(422);
});
