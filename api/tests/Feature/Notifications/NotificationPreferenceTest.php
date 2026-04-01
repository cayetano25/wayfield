<?php

use App\Models\NotificationPreference;
use App\Models\User;

uses(Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Get preferences (default) ────────────────────────────────────────────────

test('user can retrieve notification preferences returning defaults when no row exists', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/notification-preferences')
        ->assertStatus(200)
        ->assertJsonStructure([
            'email_enabled',
            'push_enabled',
            'workshop_updates_enabled',
            'reminder_enabled',
            'marketing_enabled',
        ]);

    // Verify defaults
    expect($response->json('email_enabled'))->toBeTrue();
    expect($response->json('push_enabled'))->toBeTrue();
    expect($response->json('workshop_updates_enabled'))->toBeTrue();
    expect($response->json('reminder_enabled'))->toBeTrue();
    expect($response->json('marketing_enabled'))->toBeFalse();

    // Default fetch must NOT create a row in the DB
    $this->assertDatabaseMissing('notification_preferences', ['user_id' => $user->id]);
});

// ─── Update preferences ────────────────────────────────────────────────────────

test('user can update notification preferences', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/me/notification-preferences', [
            'email_enabled'            => false,
            'push_enabled'             => true,
            'workshop_updates_enabled' => false,
            'reminder_enabled'         => true,
            'marketing_enabled'        => false,
        ])
        ->assertStatus(200)
        ->assertJson([
            'email_enabled'            => false,
            'push_enabled'             => true,
            'workshop_updates_enabled' => false,
            'reminder_enabled'         => true,
            'marketing_enabled'        => false,
        ]);

    $this->assertDatabaseHas('notification_preferences', [
        'user_id'                  => $user->id,
        'email_enabled'            => false,
        'workshop_updates_enabled' => false,
    ]);
});

// ─── Partial update ────────────────────────────────────────────────────────────

test('user can partially update notification preferences', function () {
    $user = User::factory()->create();

    // Set initial preferences
    NotificationPreference::factory()->forUser($user->id)->create([
        'email_enabled'   => true,
        'reminder_enabled' => true,
    ]);

    // Update only reminder_enabled
    $this->actingAs($user, 'sanctum')
        ->putJson('/api/v1/me/notification-preferences', [
            'reminder_enabled' => false,
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('notification_preferences', [
        'user_id'          => $user->id,
        'email_enabled'    => true,  // unchanged
        'reminder_enabled' => false, // updated
    ]);
});

// ─── Preferences do not suppress urgent notifications ─────────────────────────

test('preferences are applied to informational notifications but urgent always delivers', function () {
    // This test verifies ResolveNotificationRecipientsService behavior directly
    $user = User::factory()->create();
    NotificationPreference::factory()->forUser($user->id)->create([
        'email_enabled'            => false, // email disabled
        'push_enabled'             => false, // push disabled
        'workshop_updates_enabled' => false,
    ]);

    $org = \App\Models\Organization::factory()->create();
    $owner = User::factory()->create();
    \App\Models\OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $workshop = \App\Models\Workshop::factory()->forOrganization($org->id)->published()->sessionBased()->create();
    \App\Models\Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    // Urgent notification — should NOT be skipped regardless of preferences
    $urgentNotification = \App\Models\Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'notification_type' => 'urgent',
        'delivery_scope'    => 'all_participants',
    ]);

    $service = app(\App\Domain\Notifications\Services\ResolveNotificationRecipientsService::class);
    $recipients = $service->resolve($urgentNotification);

    $recipient = $recipients->first();
    expect($recipient->email_status)->toBe('pending'); // urgent bypasses email_enabled=false
    expect($recipient->push_status)->toBe('pending');  // urgent bypasses push_enabled=false
});

test('informational notifications respect email_enabled preference', function () {
    $user = User::factory()->create();
    NotificationPreference::factory()->forUser($user->id)->create([
        'email_enabled' => false,
    ]);

    $org = \App\Models\Organization::factory()->create();
    $owner = User::factory()->create();
    \App\Models\OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $workshop = \App\Models\Workshop::factory()->forOrganization($org->id)->published()->sessionBased()->create();
    \App\Models\Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $notification = \App\Models\Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'notification_type' => 'informational',
        'delivery_scope'    => 'all_participants',
    ]);

    $service = app(\App\Domain\Notifications\Services\ResolveNotificationRecipientsService::class);
    $recipients = $service->resolve($notification);

    $recipient = $recipients->first();
    expect($recipient->email_status)->toBe('skipped');
    expect($recipient->in_app_status)->toBe('pending'); // in-app always delivers
});
