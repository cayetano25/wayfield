<?php

use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Fixture ──────────────────────────────────────────────────────────────────

function selOpts(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);
    $user = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create();

    return [$org, $workshop, $user];
}

// ─── Visibility scope ─────────────────────────────────────────────────────────

test('selection-options only returns sessions with publication_status=published, visibility=visible, enrollment_mode=self_select', function () {
    [, $workshop, $user] = selOpts();

    $visible = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    // Hidden session — not visible to participants.
    Session::factory()->forWorkshop($workshop->id)->hidden()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    // Add-on session (hidden + organizer_assign_only).
    Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    // Draft session.
    Session::factory()->forWorkshop($workshop->id)->draft()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    $allSessions = collect($response->json('days'))
        ->flatMap(fn ($d) => collect($d['time_slots'])->flatMap(fn ($ts) => $ts['sessions']));

    expect($allSessions)->toHaveCount(1);
    expect($allSessions->first()['session_id'])->toBe($visible->id);
});

test('organizer_assign_only session does not appear in selection-options', function () {
    [, $workshop, $user] = selOpts();

    Session::factory()->forWorkshop($workshop->id)->organizerOnly()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    expect($response->json('selection_summary.total_selectable'))->toBe(0);
});

test('draft session does not appear in selection-options', function () {
    [, $workshop, $user] = selOpts();

    Session::factory()->forWorkshop($workshop->id)->draft()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    expect($response->json('selection_summary.total_selectable'))->toBe(0);
});

test('published visible self_select sessions appear in selection-options', function () {
    [, $workshop, $user] = selOpts();

    Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 14:00:00',
        'end_at' => '2026-09-01 16:00:00',
    ]);

    Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => '2026-09-01 17:00:00',
        'end_at' => '2026-09-01 19:00:00',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/selection-options")
        ->assertStatus(200);

    expect($response->json('selection_summary.total_selectable'))->toBe(2);
});
