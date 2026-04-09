<?php

use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeConflictHardeningFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    return [$org, $workshop, $user, $reg];
}

test('cannot select an overlapping session', function () {
    [, $workshop, $user] = makeConflictHardeningFixture();

    // Session A: 09:00–10:00
    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'title' => 'Morning Portraits',
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 10:00:00',
    ]);

    // Session B: 09:30–10:30 (overlaps with A)
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'title' => 'Advanced Lighting',
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:30:00',
        'end_at' => '2026-09-01 10:30:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionA->id])
        ->assertStatus(201);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(422);

    // The error must name Session A (the already-selected conflicting session).
    expect($response->json('message'))->toContain($sessionA->title);
});

test('can select adjacent non-overlapping sessions', function () {
    [, $workshop, $user] = makeConflictHardeningFixture();

    // Session A: 09:00–10:00
    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 10:00:00',
    ]);

    // Session B: 10:00–11:00 (starts exactly when A ends — not overlapping)
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 10:00:00',
        'end_at' => '2026-09-01 11:00:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionA->id])
        ->assertStatus(201);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(201);
});

test('can select a previously conflicting session after deselecting the blocking one', function () {
    [, $workshop, $user] = makeConflictHardeningFixture();

    // Session A: 09:00–10:00
    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 10:00:00',
    ]);

    // Session B: 09:30–10:30 (overlaps with A)
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:30:00',
        'end_at' => '2026-09-01 10:30:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionA->id])
        ->assertStatus(201);

    // B is blocked while A is selected.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(422);

    // Deselect A.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$sessionA->id}")
        ->assertStatus(204);

    // B is now selectable.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(201);
});

test('conflict error message names the conflicting session title', function () {
    [, $workshop, $user] = makeConflictHardeningFixture();

    // Session A has a distinctive title.
    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'title' => 'Morning Landscape Walk',
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 10:30:00',
    ]);

    // Session B overlaps with A.
    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 10:00:00',
        'end_at' => '2026-09-01 11:00:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionA->id])
        ->assertStatus(201);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(422);

    expect($response->json('message'))->toContain('Morning Landscape Walk');
});
