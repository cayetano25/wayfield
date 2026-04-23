<?php

/**
 * Tests that a participant's personal schedule handles add-on (organizer-assigned)
 * sessions correctly — they appear in the schedule after being assigned by an organizer
 * but cannot be self-selected.
 */

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

// ─── Fixture ──────────────────────────────────────────────────────────────────

function scheduleWithAddonFixture(): array
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
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $standardSession = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    $addonSession = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    return [$org, $workshop, $owner, $participant, $reg, $standardSession, $addonSession];
}

// ─── Add-on not in selection-options but in schedule after assignment ──────────

test('add-on session does not appear in selection-options for participants', function () {
    [, $workshop, , $participant] = scheduleWithAddonFixture();

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $allSessions = collect($response->json('days'))
        ->flatMap(fn ($d) => collect($d['time_slots'])->flatMap(fn ($ts) => $ts['sessions']));

    expect($allSessions)->toHaveCount(1);
});

test('after organizer assigns add-on session it appears in participant my-schedule', function () {
    [, $workshop, $owner, $participant, , , $addonSession] = scheduleWithAddonFixture();

    app(AssignParticipantToSessionAction::class)->assign($addonSession, $participant, $owner);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionIds = collect($response->json('sessions'))
        ->pluck('id')
        ->toArray();

    expect($sessionIds)->toContain($addonSession->id);
});

test('self-selected standard session also appears in my-schedule', function () {
    [, $workshop, , $participant, , $standardSession] = scheduleWithAddonFixture();

    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $standardSession->id])
        ->assertStatus(201);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionIds = collect($response->json('sessions'))->pluck('id')->toArray();
    expect($sessionIds)->toContain($standardSession->id);
});

test('both self-selected and organizer-assigned sessions appear in my-schedule simultaneously', function () {
    [, $workshop, $owner, $participant, , $standardSession, $addonSession] = scheduleWithAddonFixture();

    // Self-select the standard session.
    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $standardSession->id])
        ->assertStatus(201);

    // Organizer assigns the add-on session.
    app(AssignParticipantToSessionAction::class)->assign($addonSession, $participant, $owner);

    $response = $this->actingAs($participant, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/my-schedule")
        ->assertStatus(200);

    $sessionIds = collect($response->json('sessions'))->pluck('id')->toArray();
    expect($sessionIds)->toContain($standardSession->id);
    expect($sessionIds)->toContain($addonSession->id);
});

// ─── assignment_source preserved ──────────────────────────────────────────────

test('organizer-assigned selection records assignment_source=organizer_assigned', function () {
    [, , $owner, $participant, $reg, , $addonSession] = scheduleWithAddonFixture();

    app(AssignParticipantToSessionAction::class)->assign($addonSession, $participant, $owner);

    expect(
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $addonSession->id)
            ->where('assignment_source', 'organizer_assigned')
            ->exists()
    )->toBeTrue();
});

test('self-selected selection records assignment_source=self_selected', function () {
    [, $workshop, , $participant, $reg, $standardSession] = scheduleWithAddonFixture();

    $this->actingAs($participant, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $standardSession->id])
        ->assertStatus(201);

    expect(
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $standardSession->id)
            ->where('assignment_source', 'self_selected')
            ->exists()
    )->toBeTrue();
});
