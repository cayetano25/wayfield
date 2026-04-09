<?php

use App\Models\AttendanceRecord;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function makeDeselectionFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    return [$org, $workshop, $user, $reg];
}

test('participant can deselect a selected session', function () {
    [, $workshop, $user, $reg] = makeDeselectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    // No attendance record exists — deselection should succeed.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(204);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'canceled',
    ]);
});

test('participant cannot deselect after checking in', function () {
    [, $workshop, $user, $reg] = makeDeselectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
    ]);

    SessionSelection::factory()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    // Create a checked-in attendance record.
    AttendanceRecord::factory()->checkedIn()->forSession($session->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'You cannot remove a session you have already checked into.');
});

test('deselecting frees a capacity slot for another participant', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();

    // Session with capacity 1.
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->withCapacity(1)
        ->published()
        ->create(['delivery_type' => 'in_person']);

    // Participant A selects and fills the slot.
    $userA = User::factory()->create();
    $regA = Registration::factory()->forWorkshop($workshop->id)->forUser($userA->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $regA->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    // Participant B is registered but cannot select yet (session full).
    $userB = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($userB->id)->create();

    // Participant A deselects.
    $this->actingAs($userA, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(204);

    // Participant B can now select.
    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);
});

test('canceled selection does not block re-selection of the same session', function () {
    [, $workshop, $user, $reg] = makeDeselectionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 11:00:00',
    ]);

    // Select.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);

    // Deselect.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$session->id}")
        ->assertStatus(204);

    // Re-select.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);

    // Only one active (selected) row should exist.
    $this->assertEquals(
        1,
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->count()
    );
});

test('participant can replace a selection with a different non-overlapping session', function () {
    [, $workshop, $user, $reg] = makeDeselectionFixture();

    $sessionA = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 09:00:00',
        'end_at' => '2026-09-01 11:00:00',
    ]);

    $sessionB = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 13:00:00',
        'end_at' => '2026-09-01 15:00:00',
    ]);

    // Select Session A.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionA->id])
        ->assertStatus(201);

    // Deselect Session A.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/v1/workshops/{$workshop->id}/selections/{$sessionA->id}")
        ->assertStatus(204);

    // Select Session B.
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $sessionB->id])
        ->assertStatus(201);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $sessionA->id,
        'selection_status' => 'canceled',
    ]);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $sessionB->id,
        'selection_status' => 'selected',
    ]);
});
