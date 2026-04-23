<?php

use App\Models\AuditLog;
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

function removalFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $participant = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    $selection = SessionSelection::factory()->selfSelected()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    return [$org, $workshop, $owner, $session, $participant, $reg, $selection];
}

// ─── Authorization ────────────────────────────────────────────────────────────

test('owner can remove participant from session via destroy', function () {
    [$org, , $owner, $session, $participant] = removalFixture();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);
});

test('admin can remove participant from session', function () {
    [$org, , , $session, $participant] = removalFixture();

    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);
});

test('staff cannot remove participant via destroy endpoint', function () {
    [$org, , , $session, $participant] = removalFixture();

    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $staff->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(403);
});

test('billing_admin cannot remove participant', function () {
    [$org, , , $session, $participant] = removalFixture();

    $billing = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $billing->id,
        'role' => 'billing_admin',
        'is_active' => true,
    ]);

    $this->actingAs($billing, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(403);
});

// ─── Behavior ─────────────────────────────────────────────────────────────────

test('removal cancels the selection row without deleting it', function () {
    [, , $owner, $session, $participant, , $selection] = removalFixture();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    expect($selection->fresh()->selection_status)->toBe('canceled');
    expect(SessionSelection::find($selection->id))->not->toBeNull();
});

test('removal with optional reason stores it in audit log metadata', function () {
    [$org, , $owner, $session, $participant] = removalFixture();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}", [
            'reason' => 'Scheduling conflict',
        ])
        ->assertStatus(200);

    $log = AuditLog::where('organization_id', $org->id)
        ->where('action', 'organizer_removed')
        ->latest()
        ->first();

    expect($log->metadata_json['reason'])->toBe('Scheduling conflict');
});

test('removal does not affect the participant workshop registration', function () {
    [, , $owner, $session, $participant, $reg] = removalFixture();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    expect($reg->fresh()->registration_status)->toBe('registered');
});

// ─── Error cases ──────────────────────────────────────────────────────────────

test('returns 422 when participant not selected for session', function () {
    [$org, $workshop, $owner, $session] = removalFixture();

    $other = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($other->id)->create();
    // No selection for $other in this session.

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$other->id}")
        ->assertStatus(422);
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('removal writes organizer_removed audit log', function () {
    [$org, , $owner, $session, $participant] = removalFixture();

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(200);

    expect(
        AuditLog::where('organization_id', $org->id)
            ->where('actor_user_id', $owner->id)
            ->where('action', 'organizer_removed')
            ->exists()
    )->toBeTrue();
});

// ─── Cross-tenant ─────────────────────────────────────────────────────────────

test('cross-tenant owner cannot remove participant from another org session', function () {
    [, , , $session, $participant] = removalFixture();

    $orgB = Organization::factory()->create();
    $ownerB = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id' => $ownerB->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $this->actingAs($ownerB, 'sanctum')
        ->deleteJson("/api/v1/sessions/{$session->id}/participants/{$participant->id}")
        ->assertStatus(403);
});
