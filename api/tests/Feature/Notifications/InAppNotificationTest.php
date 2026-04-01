<?php

use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;

uses(Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInAppFixture(): array
{
    $org = Organization::factory()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create();

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    return [$org, $owner, $workshop, $participant];
}

// ─── In-app notifications retrievable ─────────────────────────────────────────

test('in-app notifications are retrievable via GET /me/notifications', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    // Create a notification and recipient row for the participant
    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'pending',
    ]);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->assertJsonStructure(['data', 'meta']);

    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.title'))->toBe($notification->title);
});

// ─── In-app notifications belong to user only ─────────────────────────────────

test('user can only see their own in-app notifications', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    $otherUser = User::factory()->create();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $otherUser->id,
        'in_app_status'   => 'pending',
    ]);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200);

    expect($response->json('data'))->toHaveCount(0);
});

// ─── Mark as read ──────────────────────────────────────────────────────────────

test('user can mark an in-app notification as read', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    $recipient = NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(200);

    $this->assertDatabaseHas('notification_recipients', [
        'id'            => $recipient->id,
        'in_app_status' => 'read',
    ]);

    $this->assertNotNull($recipient->fresh()->read_at);
});

// ─── Cannot mark another user's notification ──────────────────────────────────

test('user cannot mark another users notification as read', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    $otherUser = User::factory()->create();
    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    $recipient = NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $otherUser->id,
        'in_app_status'   => 'delivered',
    ]);

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(403);
});
