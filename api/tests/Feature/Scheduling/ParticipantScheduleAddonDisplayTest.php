<?php

use App\Domain\Sessions\Actions\AssignParticipantToSessionAction;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Shared fixture ───────────────────────────────────────────────────────────

function addonDisplayFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $standardSession = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    $addonSession = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    return [$org, $workshop, $owner, $participant, $standardSession, $addonSession];
}

// ─── is_addon field on assigned add-on session ───────────────────────────────

test('authenticated registered participant assigned to add-on session sees it in schedule with is_addon=true', function () {
    [, $workshop, $owner, $participant, , $addonSession] = addonDisplayFixture();

    app(AssignParticipantToSessionAction::class)->assign($addonSession, $participant, $owner);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessions = collect($response->json('sessions'));
    $addon = $sessions->firstWhere('id', $addonSession->id);

    expect($addon)->not->toBeNull();
    expect($addon['is_addon'])->toBeTrue();
});

// ─── Cross-participant isolation ──────────────────────────────────────────────

test('add-on session does not appear for a different registered participant not assigned to it', function () {
    [, $workshop, $owner, $participant, , $addonSession] = addonDisplayFixture();

    $otherParticipant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($otherParticipant->id)->create();

    app(AssignParticipantToSessionAction::class)->assign($addonSession, $participant, $owner);

    $response = $this->actingAs($otherParticipant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionIds = collect($response->json('sessions'))->pluck('id')->toArray();
    expect($sessionIds)->not->toContain($addonSession->id);
});

// ─── Unauthenticated access ───────────────────────────────────────────────────

test('unauthenticated request to my-schedule endpoint is rejected', function () {
    [, $workshop] = addonDisplayFixture();

    $this->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(401);
});

// ─── is_addon=false on standard sessions ─────────────────────────────────────

test('standard published visible sessions have is_addon=false in schedule response', function () {
    [, $workshop, , $participant, $standardSession] = addonDisplayFixture();

    $reg = Registration::where('workshop_id', $workshop->id)
        ->where('user_id', $participant->id)
        ->first();

    SessionSelection::factory()->selfSelected()->create([
        'registration_id' => $reg->id,
        'session_id' => $standardSession->id,
    ]);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessions = collect($response->json('sessions'));
    $standard = $sessions->firstWhere('id', $standardSession->id);

    expect($standard)->not->toBeNull();
    expect($standard['is_addon'])->toBeFalse();
});

// ─── Cancelled assignment is excluded ────────────────────────────────────────

test('cancelled add-on assignment does not cause add-on session to appear in schedule', function () {
    [, $workshop, $owner, $participant, , $addonSession] = addonDisplayFixture();

    $reg = Registration::where('workshop_id', $workshop->id)
        ->where('user_id', $participant->id)
        ->first();

    SessionSelection::factory()->organizerAssigned($owner->id)->canceled()->create([
        'registration_id' => $reg->id,
        'session_id' => $addonSession->id,
    ]);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionIds = collect($response->json('sessions'))->pluck('id')->toArray();
    expect($sessionIds)->not->toContain($addonSession->id);
});

// ─── Public endpoint excludes hidden sessions ─────────────────────────────────

test('public workshop endpoint does not include sessions with participant_visibility hidden', function () {
    [, $workshop, , , , $addonSession] = addonDisplayFixture();

    expect($addonSession->participant_visibility)->toBe('hidden');

    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $sessionIds = collect($response->json('sessions'))->pluck('id')->toArray();
    expect($sessionIds)->not->toContain($addonSession->id);
});
