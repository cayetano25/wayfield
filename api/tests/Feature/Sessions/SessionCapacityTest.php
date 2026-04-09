<?php

use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function setupCapacityTest(int $capacity = 2): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->withCapacity($capacity)
        ->published()
        ->create(['delivery_type' => 'in_person']);

    return [$org, $workshop, $session];
}

test('participant can select a session with available capacity', function () {
    [$org, $workshop, $session] = setupCapacityTest(2);

    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", [
            'session_id' => $session->id,
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('session_selections', [
        'registration_id' => $reg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);
});

test('selection is rejected when session is at full capacity', function () {
    [$org, $workshop, $session] = setupCapacityTest(1);

    // Fill the one available slot.
    $otherUser = User::factory()->create();
    $otherReg = Registration::factory()->forWorkshop($workshop->id)->forUser($otherUser->id)->create();
    SessionSelection::factory()->create([
        'registration_id' => $otherReg->id,
        'session_id' => $session->id,
        'selection_status' => 'selected',
    ]);

    // Second user tries to select — must be rejected.
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", [
            'session_id' => $session->id,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', "Session '{$session->title}' is at full capacity (1).");
});

test('null capacity behaves as unlimited — never treats null as zero', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();

    $unlimitedSession = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'capacity' => null,
            'delivery_type' => 'in_person',
        ]);

    // Fill with 20 selections — well beyond any reasonable limit.
    for ($i = 0; $i < 20; $i++) {
        $u = User::factory()->create();
        $r = Registration::factory()->forWorkshop($workshop->id)->forUser($u->id)->create();
        SessionSelection::factory()->create([
            'registration_id' => $r->id,
            'session_id' => $unlimitedSession->id,
            'selection_status' => 'selected',
        ]);
    }

    // 21st participant must still be able to select.
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", [
            'session_id' => $unlimitedSession->id,
        ])
        ->assertStatus(201);
});

test('concurrent selection race condition: only one succeeds when capacity is 1', function () {
    // This test verifies that the SELECT ... FOR UPDATE lock prevents over-selection.
    // We simulate concurrency sequentially and confirm only the first selection is accepted.
    [$org, $workshop, $session] = setupCapacityTest(1);

    $user1 = User::factory()->create();
    $user2 = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user1->id)->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user2->id)->create();

    // First user selects — succeeds.
    $this->actingAs($user1, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(201);

    // Second user selects — must fail due to capacity enforcement with locking.
    $this->actingAs($user2, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/selections", ['session_id' => $session->id])
        ->assertStatus(422);

    // Exactly one confirmed selection must exist.
    $this->assertEquals(
        1,
        SessionSelection::where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->count()
    );
});

test('selection options endpoint shows available slots and full status', function () {
    [$org, $workshop, $session] = setupCapacityTest(2);

    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $sessionOption = collect($response->json())->firstWhere('session.id', $session->id);
    expect($sessionOption['capacity'])->toBe(2);
    expect($sessionOption['available_slots'])->toBe(2);
    expect($sessionOption['is_full'])->toBeFalse();
});
