<?php

use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

function setupConflictTest(): array
{
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $user     = User::factory()->create();
    $reg      = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();
    return [$org, $workshop, $user, $reg];
}

test('overlapping session selection is rejected', function () {
    [$org, $workshop, $user, $reg] = setupConflictTest();

    // Session 1: 09:00–11:00
    $session1 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 09:00:00',
        'end_at'        => '2026-09-01 11:00:00',
    ]);

    // Session 2: 10:00–12:00 (overlaps with session 1)
    $session2 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 10:00:00',
        'end_at'        => '2026-09-01 12:00:00',
    ]);

    // Pre-select session 1.
    SessionSelection::factory()->create([
        'registration_id'  => $reg->id,
        'session_id'       => $session1->id,
        'selection_status' => 'selected',
    ]);

    // Session 2 overlaps — must be rejected.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", [
            'session_id' => $session2->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', "This session overlaps with '{$session1->title}' which you have already selected.");
});

test('non-overlapping sessions can both be selected', function () {
    [$org, $workshop, $user] = setupConflictTest();

    // Session 1: 09:00–11:00
    $session1 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 09:00:00',
        'end_at'        => '2026-09-01 11:00:00',
    ]);

    // Session 2: 13:00–15:00 (no overlap)
    $session2 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 13:00:00',
        'end_at'        => '2026-09-01 15:00:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session1->id])
        ->assertStatus(201);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session2->id])
        ->assertStatus(201);
});

test('back-to-back sessions (touching boundary) can both be selected', function () {
    [$org, $workshop, $user] = setupConflictTest();

    // Session 1: 09:00–11:00
    $session1 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 09:00:00',
        'end_at'        => '2026-09-01 11:00:00',
    ]);

    // Session 2: 11:00–13:00 (starts exactly when session 1 ends — not overlapping)
    $session2 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 11:00:00',
        'end_at'        => '2026-09-01 13:00:00',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session1->id])
        ->assertStatus(201);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session2->id])
        ->assertStatus(201);
});

test('participant can deselect a session', function () {
    [$org, $workshop, $user, $reg] = setupConflictTest();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    SessionSelection::factory()->create([
        'registration_id'  => $reg->id,
        'session_id'       => $session->id,
        'selection_status' => 'selected',
    ]);

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(204);

    $this->assertDatabaseHas('session_selections', [
        'registration_id'  => $reg->id,
        'session_id'       => $session->id,
        'selection_status' => 'canceled',
    ]);
});

test('after deselecting a session, the slot can be selected again', function () {
    [$org, $workshop, $user, $reg] = setupConflictTest();

    // Session 1: 09:00–11:00
    $session1 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 09:00:00',
        'end_at'        => '2026-09-01 11:00:00',
    ]);

    // Session 2: 10:00–12:00 (overlaps)
    $session2 = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at'      => '2026-09-01 10:00:00',
        'end_at'        => '2026-09-01 12:00:00',
    ]);

    // Select session 1.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session1->id])
        ->assertStatus(201);

    // Session 2 is rejected due to overlap.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session2->id])
        ->assertStatus(422);

    // Deselect session 1.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session1->id}")
        ->assertStatus(204);

    // Now session 2 should succeed.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session2->id])
        ->assertStatus(201);
});

test('unregistered participant cannot select sessions', function () {
    $org      = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $session  = Session::factory()->forWorkshop($workshop->id)->published()->create(['delivery_type' => 'in_person']);
    $outsider = User::factory()->create(); // not registered

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(403);
});
