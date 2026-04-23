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

function assignFixture(): array
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

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    return [$org, $workshop, $owner, $session, $participant];
}

function assignAdmin(Organization $org): User
{
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);
    return $admin;
}

function assignStaff(Organization $org): User
{
    $staff = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $staff->id,
        'role' => 'staff',
        'is_active' => true,
    ]);
    return $staff;
}

// ─── Authorization ────────────────────────────────────────────────────────────

test('owner can assign participant to session', function () {
    [$org, , $owner, $session, $participant] = assignFixture();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(201);
});

test('admin can assign participant to session', function () {
    [$org, , , $session, $participant] = assignFixture();
    $admin = assignAdmin($org);

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(201);
});

test('staff cannot assign participant to session', function () {
    [$org, , , $session, $participant] = assignFixture();
    $staff = assignStaff($org);

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(403);
});

test('billing_admin cannot assign participant to session', function () {
    [$org, , , $session, $participant] = assignFixture();

    $billing = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $billing->id,
        'role' => 'billing_admin',
        'is_active' => true,
    ]);

    $this->actingAs($billing, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(403);
});

test('unauthenticated cannot assign participant', function () {
    [, , , $session, $participant] = assignFixture();

    $this->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(401);
});

// ─── Response shape ───────────────────────────────────────────────────────────

test('assignment returns 201 with data and warnings keys', function () {
    [, , $owner, $session, $participant] = assignFixture();

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(201)
        ->assertJsonStructure(['data', 'warnings']);

    expect($response->json('data.assignment_source'))->toBe('organizer_assigned');
    expect($response->json('data.assigned_by_user_id'))->toBe($owner->id);
});

test('assignment stores assignment_notes', function () {
    [, , $owner, $session, $participant] = assignFixture();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", [
            'user_id' => $participant->id,
            'assignment_notes' => 'Priority access',
        ])
        ->assertStatus(201);

    expect(
        SessionSelection::where('session_id', $session->id)
            ->where('assignment_notes', 'Priority access')
            ->exists()
    )->toBeTrue();
});

// ─── force_assign ─────────────────────────────────────────────────────────────

test('owner can force_assign over capacity', function () {
    [$org, $workshop, $owner] = assignFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'capacity' => 1,
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    // Fill the one slot.
    $a = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($a->id)->create();
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $a->id])
        ->assertStatus(201);

    // Force-assign a second participant.
    $b = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($b->id)->create();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", [
            'user_id' => $b->id,
            'force_assign' => true,
        ])
        ->assertStatus(201);

    expect(
        SessionSelection::where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->count()
    )->toBe(2);
});

test('staff cannot use force_assign', function () {
    [$org, , , $session, $participant] = assignFixture();
    $staff = assignStaff($org);

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", [
            'user_id' => $participant->id,
            'force_assign' => true,
        ])
        ->assertStatus(403);
});

// ─── Capacity rejected ────────────────────────────────────────────────────────

test('returns 422 SESSION_AT_CAPACITY when full without force_assign', function () {
    [$org, $workshop, $owner] = assignFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'capacity' => 1,
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $a = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($a->id)->create();
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $a->id])
        ->assertStatus(201);

    $b = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($b->id)->create();

    $response = $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $b->id])
        ->assertStatus(422);

    expect($response->json('error'))->toBe('SESSION_AT_CAPACITY');
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('assignment writes organizer_assigned audit log', function () {
    [$org, , $owner, $session, $participant] = assignFixture();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(201);

    expect(
        AuditLog::where('organization_id', $org->id)
            ->where('actor_user_id', $owner->id)
            ->where('action', 'organizer_assigned')
            ->exists()
    )->toBeTrue();
});

// ─── Not registered ───────────────────────────────────────────────────────────

test('returns 422 when participant is not registered for the workshop', function () {
    [, , $owner, $session] = assignFixture();

    $stranger = User::factory()->create();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $stranger->id])
        ->assertStatus(422);
});

// ─── Cross-tenant ─────────────────────────────────────────────────────────────

test('cross-tenant owner cannot assign participants to another org session', function () {
    [, , , $session, $participant] = assignFixture();

    $orgB = Organization::factory()->create();
    $ownerB = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $orgB->id,
        'user_id' => $ownerB->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $this->actingAs($ownerB, 'sanctum')
        ->postJson("/api/v1/sessions/{$session->id}/participants", ['user_id' => $participant->id])
        ->assertStatus(403);
});
