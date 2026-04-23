<?php

use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Fixture ──────────────────────────────────────────────────────────────────

function selfSelBlockFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    return [$org, $workshop, $user, $reg];
}

// ─── Hidden session ───────────────────────────────────────────────────────────

test('self-select fails with 422 for a hidden session', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->hidden()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('SESSION_NOT_VISIBLE_FOR_SELECTION');
});

// ─── Add-on session ───────────────────────────────────────────────────────────

test('self-select fails with 422 for an add-on session', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBeIn([
        'SESSION_NOT_VISIBLE_FOR_SELECTION',
        'SESSION_NOT_SELF_SELECTABLE',
    ]);
});

// ─── organizer_assign_only ────────────────────────────────────────────────────

test('self-select fails with 422 for an organizer_assign_only session', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->organizerOnly()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('SESSION_NOT_SELF_SELECTABLE');
});

// ─── Draft session ────────────────────────────────────────────────────────────

test('self-select fails with 422 for a draft session', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->draft()->create([
        'participant_visibility' => 'visible',
        'enrollment_mode' => 'self_select',
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('SESSION_NOT_PUBLISHED');
});

// ─── Selection window: not yet open ──────────────────────────────────────────

test('self-select fails with 422 when selection window has not opened', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
        'selection_opens_at' => now()->addDays(3)->toIso8601String(),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('SESSION_SELECTION_WINDOW_CLOSED');
});

// ─── Selection window: closed ─────────────────────────────────────────────────

test('self-select fails with 422 when selection window has closed', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
        'selection_opens_at' => now()->subDays(10)->toIso8601String(),
        'selection_closes_at' => now()->subDays(3)->toIso8601String(),
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('SESSION_SELECTION_WINDOW_CLOSED');
});

// ─── Standard session still works ─────────────────────────────────────────────

test('self-select succeeds for a standard published visible self_select session', function () {
    [, $workshop, $user] = selfSelBlockFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);
});
