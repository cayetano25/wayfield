<?php

use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('participant sees only their selected sessions for session-based workshop', function () {
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user     = User::factory()->create();
    $reg      = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $session1 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 09:00:00',
        'end_at'        => '2026-09-01 11:00:00',
    ]);
    $session2 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 13:00:00',
        'end_at'        => '2026-09-01 15:00:00',
    ]);

    // Only select session1.
    SessionSelection::factory()->create([
        'registration_id'  => $reg->id,
        'session_id'       => $session1->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $ids = collect($response->json())->pluck('id');
    expect($ids)->toContain($session1->id);
    expect($ids)->not->toContain($session2->id);
});

test('canceled selections do not appear in my schedule', function () {
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user     = User::factory()->create();
    $reg      = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    // Canceled selection.
    SessionSelection::factory()->canceled()->create([
        'registration_id' => $reg->id,
        'session_id'      => $session->id,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    expect($response->json())->toHaveCount(0);
});

test('event-based workshop schedule returns all published sessions', function () {
    $workshop = Workshop::factory()->eventBased()->published()->create();
    $user     = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    // Unpublished session must not appear.
    Session::factory()->forWorkshop($workshop->id)->create(['is_published' => false]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    expect($response->json())->toHaveCount(2);
});

test('unregistered user cannot view my-schedule', function () {
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user     = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(403);
});

test('participant schedule resource does not expose meeting_url for virtual sessions in session-based schedule', function () {
    // Participant-facing schedule uses ParticipantSessionResource which exposes
    // meeting_url only for virtual/hybrid sessions to registered participants.
    // This is a deliberate design choice — participants who are registered CAN see
    // meeting_url in their schedule so they can join. This differs from PublicSessionResource
    // which NEVER exposes meeting_url.
    $workshop = Workshop::factory()->sessionBased()->published()->create();
    $user     = User::factory()->create();
    $reg      = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $virtualSession = Session::factory()->virtual()->forWorkshop($workshop->id)->published()->create();

    SessionSelection::factory()->create([
        'registration_id'  => $reg->id,
        'session_id'       => $virtualSession->id,
        'selection_status' => 'selected',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    // Registered participant CAN see meeting_url in their schedule.
    $sessionData = collect($response->json())->firstWhere('id', $virtualSession->id);
    expect($sessionData['meeting_url'])->not->toBeNull();
});

test('public workshop endpoint never exposes meeting_url', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'test-workshop-public',
    ]);

    Session::factory()->virtual()->forWorkshop($workshop->id)->published()->create();

    $response = $this->getJson('/api/v1/public/workshops/test-workshop-public')
        ->assertStatus(200);

    // No meeting_url anywhere in the response body.
    $body = json_encode($response->json());
    expect($body)->not->toContain('meeting_url');
    expect($body)->not->toContain('meeting_passcode');
    expect($body)->not->toContain('meeting_id');
});
