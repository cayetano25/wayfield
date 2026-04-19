<?php

use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Fixture ─────────────────────────────────────────────────────────────────

function makeHistoryFixture(): array
{
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->starter()->active()->create();

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

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create();

    // Leader user with a Leader profile
    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->withUser($leaderUser->id)->create();
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    // Organizer notification
    $orgNotification = Notification::factory()->forWorkshop($workshop->id, $org->id, $owner->id)->create([
        'sender_scope' => 'organizer',
        'delivery_scope' => 'all_participants',
        'session_id' => null,
    ]);

    // Leader notification (with session)
    $leaderNotification = Notification::factory()->forWorkshop($workshop->id, $org->id, $leaderUser->id)->create([
        'sender_scope' => 'leader',
        'delivery_scope' => 'session_participants',
        'session_id' => $session->id,
    ]);

    return [$org, $owner, $workshop, $session, $leaderUser, $leader, $orgNotification, $leaderNotification];
}

// ─── Organizer sees both notification types ───────────────────────────────────

test('organizer sees both organizer and leader notifications in history', function () {
    [$org, $owner, $workshop, $session, $leaderUser, $leader, $orgNotification, $leaderNotification]
        = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications")
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id')->all();

    expect($ids)->toContain($orgNotification->id);
    expect($ids)->toContain($leaderNotification->id);
    expect($response->json())->toHaveCount(2);
});

// ─── Filter: sender_scope=leader ─────────────────────────────────────────────

test('sender_scope=leader returns only leader notifications', function () {
    [$org, $owner, $workshop, , , , $orgNotification, $leaderNotification]
        = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications?sender_scope=leader")
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id')->all();

    expect($ids)->toContain($leaderNotification->id);
    expect($ids)->not->toContain($orgNotification->id);
});

// ─── Filter: sender_scope=organizer ──────────────────────────────────────────

test('sender_scope=organizer returns only organizer notifications', function () {
    [$org, $owner, $workshop, , , , $orgNotification, $leaderNotification]
        = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications?sender_scope=organizer")
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id')->all();

    expect($ids)->toContain($orgNotification->id);
    expect($ids)->not->toContain($leaderNotification->id);
});

// ─── Leader is rejected ───────────────────────────────────────────────────────

test('leader cannot access the organizer notification history endpoint', function () {
    [$org, $owner, $workshop, , $leaderUser] = makeHistoryFixture();

    $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications")
        ->assertStatus(403);
});

// ─── Leader object populated for leader notifications ────────────────────────

test('leader notification response includes populated leader object', function () {
    [$org, $owner, $workshop, , $leaderUser, $leader, , $leaderNotification]
        = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications?sender_scope=leader")
        ->assertStatus(200);

    $item = collect($response->json())->firstWhere('id', $leaderNotification->id);

    expect($item['sender_scope'])->toBe('leader');
    expect($item['leader'])->not->toBeNull();
    expect($item['leader']['id'])->toBe($leader->id);
    expect($item['leader']['first_name'])->toBe($leader->first_name);
    expect($item['leader']['last_name'])->toBe($leader->last_name);
});

// ─── Organizer notification has null leader ───────────────────────────────────

test('organizer notification has null leader field', function () {
    [$org, $owner, $workshop, , , , $orgNotification] = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications?sender_scope=organizer")
        ->assertStatus(200);

    $item = collect($response->json())->firstWhere('id', $orgNotification->id);

    expect($item['sender_scope'])->toBe('organizer');
    expect($item['leader'])->toBeNull();
});

// ─── session_title populated when session_id is set ──────────────────────────

test('session_title is populated on leader notifications that have a session', function () {
    [$org, $owner, $workshop, $session, , , , $leaderNotification]
        = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications?sender_scope=leader")
        ->assertStatus(200);

    $item = collect($response->json())->firstWhere('id', $leaderNotification->id);

    expect($item['session_id'])->toBe($session->id);
    expect($item['session_title'])->toBe($session->title);
});

// ─── created_by includes id ───────────────────────────────────────────────────

test('response includes created_by with id, first_name, last_name', function () {
    [$org, $owner, $workshop, , , , $orgNotification] = makeHistoryFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/notifications?sender_scope=organizer")
        ->assertStatus(200);

    $item = collect($response->json())->firstWhere('id', $orgNotification->id);

    expect($item['created_by'])->toMatchArray([
        'id' => $owner->id,
        'first_name' => $owner->first_name,
        'last_name' => $owner->last_name,
    ]);
});
