<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

function ownerWithWorkshop(): array
{
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    return [$user, $org, $workshop];
}

test('owner can publish an in_person session', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'delivery_type' => 'in_person',
        'meeting_url'   => null,
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(200)
        ->assertJsonPath('is_published', true);
});

test('virtual session cannot be published without meeting_url', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->virtualWithoutUrl()->forWorkshop($workshop->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(422)
        ->assertJsonPath('errors.meeting_url.0', 'Virtual sessions require a meeting URL before publishing.');
});

test('virtual session can be published when meeting_url is provided', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->virtual()->forWorkshop($workshop->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(200)
        ->assertJsonPath('is_published', true);
});

test('hybrid session with virtual_participation_allowed=true requires meeting_url', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'delivery_type'                => 'hybrid',
        'virtual_participation_allowed' => true,
        'meeting_url'                  => null,
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(422)
        ->assertJsonPath('errors.meeting_url.0', 'Hybrid with virtual participation sessions require a meeting URL before publishing.');
});

test('hybrid session with virtual_participation_allowed=false can publish without meeting_url', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    // Interim hybrid open issue resolution: no virtual participation = no meeting_url required
    $session = Session::factory()->hybridWithoutVirtualParticipation()->forWorkshop($workshop->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(200)
        ->assertJsonPath('is_published', true);
});

test('publishing is idempotent for already-published session', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(200)
        ->assertJsonPath('is_published', true);
});

test('publish fails when title is blank', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->forWorkshop($workshop->id)->create(['title' => '']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(422)
        ->assertJsonPath('errors.title.0', 'Session title is required before publishing.');
});

test('publish fails when start_at is not before end_at', function () {
    [$user,, $workshop] = ownerWithWorkshop();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'start_at' => '2026-09-01 12:00:00',
        'end_at'   => '2026-09-01 10:00:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(422)
        ->assertJsonPath('errors.start_at.0', 'Session start time must be before end time.');
});

test('staff cannot publish a session', function () {
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $session  = Session::factory()->forWorkshop($workshop->id)->create(['delivery_type' => 'in_person']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(403);
});
