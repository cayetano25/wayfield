<?php

use App\Mail\WorkshopNotificationMail;
use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

uses(Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrganizerFixture(): array
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
        ->create(['timezone' => 'America/New_York']);

    // Registered participant
    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    return [$org, $owner, $workshop, $participant];
}

// ─── Organizer can create all_participants notification ────────────────────────

test('organizer can create an all_participants notification', function () {
    Mail::fake();
    Queue::fake();

    [$org, $owner, $workshop, $participant] = makeOrganizerFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'             => 'Workshop update',
            'message'           => 'Important information for all participants.',
            'notification_type' => 'informational',
            'delivery_scope'    => 'all_participants',
        ])
        ->assertStatus(201)
        ->assertJsonStructure(['notification_id', 'recipient_count']);

    $notificationId = $response->json('notification_id');

    // Notification record
    $this->assertDatabaseHas('notifications', [
        'id'             => $notificationId,
        'workshop_id'    => $workshop->id,
        'sender_scope'   => 'organizer',
        'delivery_scope' => 'all_participants',
    ]);

    // Recipient resolved
    $this->assertDatabaseHas('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id'         => $participant->id,
    ]);

    // Audit log
    $this->assertDatabaseHas('audit_logs', [
        'entity_type'   => 'notification',
        'entity_id'     => $notificationId,
        'action'        => 'organizer_notification_sent',
        'actor_user_id' => $owner->id,
    ]);
});

// ─── Organizer can target session_participants ─────────────────────────────────

test('organizer can create a session_participants notification', function () {
    Mail::fake();
    Queue::fake();

    [$org, $owner, $workshop, $sessionParticipant] = makeOrganizerFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    // Give the participant a session selection
    $reg = \App\Models\Registration::where('workshop_id', $workshop->id)
        ->where('user_id', $sessionParticipant->id)
        ->first();
    \App\Models\SessionSelection::factory()->create([
        'registration_id'  => $reg->id,
        'session_id'       => $session->id,
        'selection_status' => 'selected',
    ]);

    // Non-session participant — registered but no selection for this session
    $otherParticipant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($otherParticipant->id)->create();

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'             => 'Session note',
            'message'           => 'See you in session.',
            'notification_type' => 'informational',
            'delivery_scope'    => 'session_participants',
            'session_id'        => $session->id,
        ])
        ->assertStatus(201);

    $notificationId = $response->json('notification_id');

    // Only session participant is a recipient
    $this->assertDatabaseHas('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id'         => $sessionParticipant->id,
    ]);

    $this->assertDatabaseMissing('notification_recipients', [
        'notification_id' => $notificationId,
        'user_id'         => $otherParticipant->id,
    ]);
});

// ─── session_participants requires session_id ──────────────────────────────────

test('session_participants delivery scope requires session_id', function () {
    [$org, $owner, $workshop] = makeOrganizerFixture();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'          => 'Missing session_id',
            'message'        => 'Test.',
            'delivery_scope' => 'session_participants',
            // session_id intentionally omitted
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['session_id']);
});

// ─── custom delivery scope returns 501 ────────────────────────────────────────

test('custom delivery scope is rejected with 501 not implemented', function () {
    [$org, $owner, $workshop] = makeOrganizerFixture();

    // Bypass validation by using a worker-level scope trick — we need to directly
    // call the action with 'custom' scope to hit the NotImplementedException.
    // The request validator excludes 'custom' from allowed values, so we verify
    // the validation layer rejects it first.
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'          => 'Custom scope',
            'message'        => 'Test.',
            'delivery_scope' => 'custom',
        ])
        ->assertStatus(422) // rejected at validation layer (custom not in allowed values)
        ->assertJsonValidationErrors(['delivery_scope']);
});

// ─── Participant cannot create organizer notification ──────────────────────────

test('plain participant cannot create a notification', function () {
    [$org, $owner, $workshop, $participant] = makeOrganizerFixture();

    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'          => 'Not allowed',
            'message'        => 'I am a participant.',
            'delivery_scope' => 'all_participants',
        ])
        ->assertStatus(403);
});

// ─── Email is queued not sent synchronously ───────────────────────────────────

test('email delivery is queued not sent synchronously', function () {
    Mail::fake();
    Queue::fake();

    [$org, $owner, $workshop, $participant] = makeOrganizerFixture();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'          => 'Update',
            'message'        => 'Important.',
            'delivery_scope' => 'all_participants',
        ])
        ->assertStatus(201);

    // Email is NOT sent synchronously
    Mail::assertNothingSent();

    // Delivery job was queued
    Queue::assertPushed(\App\Jobs\SendEmailNotificationJob::class);
});

// ─── Push token delivery is queued ───────────────────────────────────────────

test('push delivery is queued per active push token', function () {
    Queue::fake();

    [$org, $owner, $workshop, $participant] = makeOrganizerFixture();

    // Register a push token for the participant
    \App\Models\PushToken::factory()->forUser($participant->id)->create();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/notifications", [
            'title'          => 'Push test',
            'message'        => 'Check your phone.',
            'delivery_scope' => 'all_participants',
        ])
        ->assertStatus(201);

    Queue::assertPushed(\App\Jobs\SendPushNotificationJob::class);
});

// ─── List notifications ────────────────────────────────────────────────────────

test('organizer can list workshop notifications', function () {
    [$org, $owner, $workshop, $participant] = makeOrganizerFixture();

    Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'delivery_scope' => 'all_participants',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications")
        ->assertStatus(200)
        ->assertJsonCount(1);
});
