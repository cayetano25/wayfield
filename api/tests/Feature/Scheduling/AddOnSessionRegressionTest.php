<?php

/**
 * Regression suite: Existing session management features must still work
 * correctly after the add-on sessions / access-control fields migration.
 */

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function regressionOwner(): array
{
    $org = Organization::factory()->create();
    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);
    return [$org, $owner, $workshop];
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

test('creating a session without access-control fields uses sensible defaults', function () {
    [$org, $owner, $workshop] = regressionOwner();

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/sessions", [
            'title' => 'Morning Walk',
            'start_at' => '2026-09-01 09:00:00',
            'end_at' => '2026-09-01 11:00:00',
            'delivery_type' => 'in_person',
        ])
        ->assertStatus(201);

    expect($response->json('session_type'))->toBe('standard');
    expect($response->json('publication_status'))->toBe('draft');
    expect($response->json('participant_visibility'))->toBe('visible');
    expect($response->json('enrollment_mode'))->toBe('self_select');
    expect($response->json('requires_separate_entitlement'))->toBeFalse();
});

test('updating a session with new access-control fields persists correctly', function () {
    [$org, $owner, $workshop] = regressionOwner();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/sessions/{$session->id}", [
            'session_type' => 'addon',
            'participant_visibility' => 'hidden',
            'enrollment_mode' => 'organizer_assign_only',
        ])
        ->assertStatus(200);

    expect($session->fresh()->session_type)->toBe('addon');
    expect($session->fresh()->participant_visibility)->toBe('hidden');
    expect($session->fresh()->enrollment_mode)->toBe('organizer_assign_only');
});

// ─── Publication status ───────────────────────────────────────────────────────

test('publishing a session sets both publication_status and is_published', function () {
    [$org, $owner, $workshop] = regressionOwner();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
        'publication_status' => 'draft',
        'is_published' => false,
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/publish")
        ->assertStatus(200);

    $fresh = $session->fresh();
    expect($fresh->publication_status)->toBe('published');
    expect($fresh->is_published)->toBeTrue();
});

// ─── Capacity enforcement still works ────────────────────────────────────────

test('standard published session still enforces capacity', function () {
    [$org, , $workshop] = regressionOwner();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'capacity' => 1,
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $first = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($first->id)->create();
    $this->actingAs($first, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);

    $second = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($second->id)->create();
    $this->actingAs($second, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);
});

// ─── scopePublished alias ─────────────────────────────────────────────────────

test('scopePublished and scopeIsPublished return the same results', function () {
    [$org, , $workshop] = regressionOwner();

    Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    Session::factory()->forWorkshop($workshop->id)->draft()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $published = Session::where('workshop_id', $workshop->id)->published()->get();
    $isPublished = Session::where('workshop_id', $workshop->id)->isPublished()->get();

    expect($published->pluck('id')->sort()->values())
        ->toEqual($isPublished->pluck('id')->sort()->values());
});

// ─── Session delete ───────────────────────────────────────────────────────────

test('session with new fields can be retrieved by organizer', function () {
    [$org, $owner, $workshop] = regressionOwner();

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200);

    expect($response->json('session_type'))->toBe('addon');
});

// ─── Factory state consistency ────────────────────────────────────────────────

test('SessionFactory published() state sets both is_published and publication_status', function () {
    [$org, , $workshop] = regressionOwner();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    expect($session->publication_status)->toBe('published');
    expect($session->is_published)->toBeTrue();
});
