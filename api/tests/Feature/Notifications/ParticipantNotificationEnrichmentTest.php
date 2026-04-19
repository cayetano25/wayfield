<?php

use App\Models\Leader;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Fixture ──────────────────────────────────────────────────────────────────

function enrichmentFixture(): array
{
    $org = Organization::factory()->create(['name' => 'Aperture Guild']);

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
        ->create(['timezone' => 'America/New_York']);

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'title'    => 'Morning Shoot',
        'start_at' => '2026-06-01 09:00:00',
        'end_at'   => '2026-06-01 11:00:00',
    ]);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    return [$org, $owner, $workshop, $session, $participant];
}

// ─── Sender and context fields present on every row ───────────────────────────

test('every notification row includes sender, workshop_context, and session_context keys', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

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
    expect($item)->toHaveKeys(['sender', 'workshop_context', 'session_context']);
});

// ─── Organizer sender ─────────────────────────────────────────────────────────

test('organizer notification has sender.type = organizer with org name', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'sender_scope' => 'organizer',
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $item = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0');

    expect($item['sender']['type'])->toBe('organizer');
    expect($item['sender']['name'])->toBe('Aperture Guild');
    expect($item['sender']['display_label'])->toBe('Aperture Guild');
});

// ─── Leader sender — correct fields ───────────────────────────────────────────

test('leader notification has sender.type = leader with name and display_label', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $leaderUser = User::factory()->create(['first_name' => 'Ana', 'last_name' => 'Costa']);
    Leader::factory()->withUser($leaderUser->id)->create([
        'first_name'        => 'Ana',
        'last_name'         => 'Costa',
        'profile_image_url' => 'https://cdn.example.com/ana.jpg',
    ]);

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $leaderUser->id)->create([
        'sender_scope'    => 'leader',
        'delivery_scope'  => 'session_participants',
        'session_id'      => $session->id,
        'created_by_user_id' => $leaderUser->id,
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $item = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0');

    expect($item['sender']['type'])->toBe('leader');
    expect($item['sender']['first_name'])->toBe('Ana');
    expect($item['sender']['last_name'])->toBe('Costa');
    expect($item['sender']['display_label'])->toBe('Ana Costa · Session Leader');
    expect($item['sender']['profile_image_url'])->toBe('https://cdn.example.com/ana.jpg');
});

// ─── Leader sender — privacy: email and phone NEVER exposed ───────────────────

test('leader sender object never exposes email or phone_number', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $leaderUser = User::factory()->create();
    Leader::factory()->withUser($leaderUser->id)->create([
        'email'        => 'private@leader.com',
        'phone_number' => '+15550001234',
    ]);

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $leaderUser->id)->create([
        'sender_scope'       => 'leader',
        'delivery_scope'     => 'session_participants',
        'session_id'         => $session->id,
        'created_by_user_id' => $leaderUser->id,
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $sender = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0.sender');

    expect($sender)->not->toHaveKey('email');
    expect($sender)->not->toHaveKey('phone_number');
    expect($sender)->not->toHaveKey('address_line_1');
    expect($sender)->not->toHaveKey('city');
    expect($sender)->not->toHaveKey('country');
});

// ─── Organizer sender — privacy ───────────────────────────────────────────────

test('organizer sender never exposes contact email, phone, or stripe data', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'sender_scope' => 'organizer',
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $sender = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0.sender');

    expect($sender)->not->toHaveKey('primary_contact_email');
    expect($sender)->not->toHaveKey('primary_contact_phone');
    expect($sender)->not->toHaveKey('stripe_customer_id');
});

// ─── session_context present when session_id set ──────────────────────────────

test('session_context is present when notification has a session_id', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'session_id' => $session->id,
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $ctx = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0.session_context');

    expect($ctx)->not->toBeNull();
    expect($ctx['session_id'])->toBe($session->id);
    expect($ctx['session_title'])->toBe('Morning Shoot');
    expect($ctx['start_at'])->toBeString();
    expect($ctx['end_at'])->toBeString();
    expect($ctx['workshop_timezone'])->toBe('America/New_York');
});

// ─── session_context null when no session_id ─────────────────────────────────

test('session_context is null when notification has no session_id', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'session_id' => null,
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $item = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0');

    expect($item['session_context'])->toBeNull();
    expect($item['workshop_context'])->not->toBeNull();
    expect($item['workshop_context']['workshop_id'])->toBe($workshop->id);
    expect($item['workshop_context']['workshop_title'])->toBe($workshop->title);
});

// ─── workshop_context always present ─────────────────────────────────────────

test('workshop_context is always present with id and title', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $notification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    NotificationRecipient::factory()->create([
        'notification_id' => $notification->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $ctx = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('data.0.workshop_context');

    expect($ctx)->toHaveKeys(['workshop_id', 'workshop_title']);
    expect($ctx['workshop_id'])->toBe($workshop->id);
});

// ─── meta.unread_count ────────────────────────────────────────────────────────

test('meta.unread_count reflects actual unread count for the user', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    // 3 unread
    Notification::factory()->count(3)->forWorkshop($workshop->id, $org->id, $owner->id)
        ->create()
        ->each(fn ($n) => NotificationRecipient::factory()->create([
            'notification_id' => $n->id,
            'user_id'         => $participant->id,
            'in_app_status'   => 'delivered',
        ]));

    // 1 already read — must not count
    $readN = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    NotificationRecipient::factory()->read()->create([
        'notification_id' => $readN->id,
        'user_id'         => $participant->id,
    ]);

    $meta = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('meta');

    expect($meta['unread_count'])->toBe(3);
});

// ─── meta.has_urgent_unread ───────────────────────────────────────────────────

test('meta.has_urgent_unread is true when an urgent unread notification exists', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $urgentN = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'notification_type' => 'urgent',
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $urgentN->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $meta = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('meta');

    expect($meta['has_urgent_unread'])->toBeTrue();
});

test('meta.has_urgent_unread is false when no urgent unread notification exists', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $n = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'notification_type' => 'informational',
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $n->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $meta = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('meta');

    expect($meta['has_urgent_unread'])->toBeFalse();
});

// ─── meta.has_leader_unread ───────────────────────────────────────────────────

test('meta.has_leader_unread is true when a leader-scoped unread notification exists', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $leaderUser = User::factory()->create();
    $n = Notification::factory()->forWorkshop($workshop->id, $org->id, $leaderUser->id)->create([
        'sender_scope'       => 'leader',
        'delivery_scope'     => 'session_participants',
        'session_id'         => $session->id,
        'created_by_user_id' => $leaderUser->id,
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $n->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $meta = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('meta');

    expect($meta['has_leader_unread'])->toBeTrue();
});

test('meta.has_leader_unread is false when no leader-scoped unread notification exists', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $n = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'sender_scope' => 'organizer',
    ]);
    NotificationRecipient::factory()->create([
        'notification_id' => $n->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $meta = $this->actingAs($participant, 'sanctum')
        ->getJson('/api/v1/me/notifications')
        ->assertStatus(200)
        ->json('meta');

    expect($meta['has_leader_unread'])->toBeFalse();
});

// ─── Mark as read — sets in_app_status + read_at ─────────────────────────────

test('mark-as-read sets in_app_status to read and records read_at', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $n = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    $recipient = NotificationRecipient::factory()->create([
        'notification_id' => $n->id,
        'user_id'         => $participant->id,
        'in_app_status'   => 'delivered',
    ]);

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(200)
        ->assertJson(['is_read' => true]);

    $fresh = $recipient->fresh();
    expect($fresh->in_app_status)->toBe('read');
    expect($fresh->read_at)->not->toBeNull();
});

// ─── Mark as read — user cannot mark another user's notification ──────────────

test('user cannot mark another users notification as read — returns 403', function () {
    [$org, $owner, $workshop, $session, $participant] = enrichmentFixture();

    $otherUser = User::factory()->create();
    $n = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create();
    $recipient = NotificationRecipient::factory()->create([
        'notification_id' => $n->id,
        'user_id'         => $otherUser->id,
        'in_app_status'   => 'delivered',
    ]);

    $this->actingAs($participant, 'sanctum')
        ->patchJson("/api/v1/me/notifications/{$recipient->id}/read")
        ->assertStatus(403);

    // Recipient must remain unread
    expect($recipient->fresh()->in_app_status)->toBe('delivered');
});
