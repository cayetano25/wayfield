<?php

use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Fixture ──────────────────────────────────────────────────────────────────

function serializerPrivacyFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $participant = User::factory()->create(['phone_number' => '555-9999']);
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    $selection = SessionSelection::factory()->selfSelected()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    return [$org, $workshop, $session, $participant, $reg, $selection];
}

function privacyOrg(Organization $org, string $role): User
{
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);
    return $user;
}

// ─── Phone number visibility ──────────────────────────────────────────────────

test('owner sees phone number in participant list', function () {
    [$org, , $session] = serializerPrivacyFixture();
    $owner = privacyOrg($org, 'owner');

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    expect($response->json('data.0.phone_number'))->toBe('555-9999');
});

test('admin sees phone number in participant list', function () {
    [$org, , $session] = serializerPrivacyFixture();
    $admin = privacyOrg($org, 'admin');

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    expect($response->json('data.0.phone_number'))->toBe('555-9999');
});

test('staff sees phone number in participant list', function () {
    [$org, , $session] = serializerPrivacyFixture();
    $staff = privacyOrg($org, 'staff');

    $response = $this->actingAs($staff, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    expect($response->json('data.0.phone_number'))->toBe('555-9999');
});

test('assigned leader sees phone number in participant list', function () {
    [$org, , $session] = serializerPrivacyFixture();

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $leaderUser->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    $response = $this->actingAs($leaderUser, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}/participants")
        ->assertStatus(200);

    expect($response->json('data.0.phone_number'))->toBe('555-9999');
});

// ─── OrganizerSessionResource access-control fields ───────────────────────────

test('OrganizerSessionResource includes session_type and publication_status', function () {
    [$org, $workshop] = serializerPrivacyFixture();
    $owner = privacyOrg($org, 'owner');

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200);

    expect($response->json('session_type'))->toBe('addon');
    expect($response->json('publication_status'))->toBe('published');
    expect($response->json('participant_visibility'))->toBe('hidden');
    expect($response->json('enrollment_mode'))->toBe('organizer_assign_only');
});

test('OrganizerSessionResource includes requires_separate_entitlement', function () {
    [$org, $workshop] = serializerPrivacyFixture();
    $owner = privacyOrg($org, 'owner');

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'publication_status' => 'published',
        'is_published' => true,
        'requires_separate_entitlement' => true,
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200);

    expect($response->json('requires_separate_entitlement'))->toBeTrue();
});

test('OrganizerSessionResource includes selection window fields', function () {
    [$org, $workshop] = serializerPrivacyFixture();
    $owner = privacyOrg($org, 'owner');

    $opensAt = now()->addDays(5);
    $closesAt = now()->addDays(10);

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
        'selection_opens_at' => $opensAt->toIso8601String(),
        'selection_closes_at' => $closesAt->toIso8601String(),
    ]);

    $response = $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200);

    expect($response->json('selection_opens_at'))->not->toBeNull();
    expect($response->json('selection_closes_at'))->not->toBeNull();
});
