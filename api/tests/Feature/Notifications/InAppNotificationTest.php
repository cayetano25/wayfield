<?php

use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInAppFixture(): array
{
    $org = Organization::factory()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
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
        'user_id' => $participant->id,
        'in_app_status' => 'pending',
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
        'user_id' => $otherUser->id,
        'in_app_status' => 'pending',
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
        'user_id' => $participant->id,
        'in_app_status' => 'delivered',
    ]);

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(200);

    $this->assertDatabaseHas('notification_recipients', [
        'id' => $recipient->id,
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
        'user_id' => $otherUser->id,
        'in_app_status' => 'delivered',
    ]);

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(403);
});

// ─── Unread count ─────────────────────────────────────────────────────────────

test('unread-count returns 0 for user with no notifications', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/notifications/unread-count')
        ->assertStatus(200)
        ->assertJson(['unread_count' => 0]);
});

test('unread-count returns correct count for delivered notifications', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    // Each recipient needs its own notification (unique notification_id + user_id)
    Notification::factory()->count(3)->forWorkshop($workshop->id, $org->id, $owner->id)
        ->create()
        ->each(fn ($n) => NotificationRecipient::factory()->create([
            'notification_id' => $n->id,
            'user_id'         => $participant->id,
            'in_app_status'   => 'delivered',
        ]));

    $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications/unread-count')
        ->assertStatus(200)
        ->assertJson(['unread_count' => 3]);
});

test('unread-count does not count already-read notifications', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    Notification::factory()->count(2)->forWorkshop($workshop->id, $org->id, $owner->id)
        ->create()
        ->each(fn ($n) => NotificationRecipient::factory()->create([
            'notification_id' => $n->id,
            'user_id'         => $participant->id,
            'in_app_status'   => 'delivered',
        ]));

    $readNotification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    NotificationRecipient::factory()->read()->create([
        'notification_id' => $readNotification->id,
        'user_id'         => $participant->id,
    ]);

    $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications/unread-count')
        ->assertStatus(200)
        ->assertJson(['unread_count' => 2]);
});

// ─── Response shape ───────────────────────────────────────────────────────────

test('index returns notifications with correct shape', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200);

    $item = $response->json('data.0');
    expect($item)->toHaveKeys([
        'recipient_id', 'notification_id', 'title', 'message',
        'notification_category', 'is_read', 'is_invitation', 'created_at',
    ]);
    expect($item['notification_category'])->toBe('message');
    expect($item['is_invitation'])->toBeFalse();
});

// ─── Mark read — idempotent ───────────────────────────────────────────────────

test('mark read is idempotent — calling twice does not error', function () {
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

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(200);
});

// ─── Read all ─────────────────────────────────────────────────────────────────

test('read-all marks all delivered notifications as read', function () {
    [$org, $owner, $workshop, $participant] = makeInAppFixture();

    Notification::factory()->count(5)->forWorkshop($workshop->id, $org->id, $owner->id)
        ->create()
        ->each(fn ($n) => NotificationRecipient::factory()->create([
            'notification_id' => $n->id,
            'user_id'         => $participant->id,
            'in_app_status'   => 'delivered',
        ]));

    $this->actingAs($participant, 'sanctum')
        ->postJson('/api/v1/me/notifications/read-all')
        ->assertStatus(200)
        ->assertJson(['marked_read' => 5, 'unread_count' => 0]);

    expect(NotificationRecipient::where('user_id', $participant->id)
        ->where('in_app_status', 'read')
        ->count())->toBe(5);
});

test('read-all returns 0 when nothing to mark', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/me/notifications/read-all')
        ->assertStatus(200)
        ->assertJson(['marked_read' => 0, 'unread_count' => 0]);
});
