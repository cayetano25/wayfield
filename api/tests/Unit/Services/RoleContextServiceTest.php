<?php

declare(strict_types=1);

use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use App\Services\Auth\RoleContextService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── orgRole() ────────────────────────────────────────────

test('orgRole resolves owner correctly', function () {
    $svc = app(RoleContextService::class);
    [$org, $user] = makeOrgMember('owner');
    expect($svc->orgRole($user, $org))->toBe('owner');
});

test('orgRole resolves billing_admin correctly', function () {
    $svc = app(RoleContextService::class);
    [$org, $user] = makeOrgMember('billing_admin');
    expect($svc->orgRole($user, $org))->toBe('billing_admin');
});

test('orgRole returns null for non-member', function () {
    $svc = app(RoleContextService::class);
    $org = Organization::factory()->create();
    $outsider = User::factory()->create();
    expect($svc->orgRole($outsider, $org))->toBeNull();
});

// ─── isParticipant() ──────────────────────────────────────

test('isParticipant returns true for registered user', function () {
    $svc = app(RoleContextService::class);
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $user->id,
        'registration_status' => 'registered',
    ]);

    expect($svc->isParticipant($user, $workshop))->toBeTrue();
});

test('isParticipant returns false for non-registered user', function () {
    $svc = app(RoleContextService::class);
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    expect($svc->isParticipant($user, $workshop))->toBeFalse();
});

test('isParticipant returns false for cancelled registration', function () {
    $svc = app(RoleContextService::class);
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $user->id,
        'registration_status' => 'canceled', // not 'registered'
    ]);

    expect($svc->isParticipant($user, $workshop))->toBeFalse();
});

// ─── isParticipantInSession() — session-based ─────────────

test('isParticipantInSession returns true when registered and selected', function () {
    $svc = app(RoleContextService::class);
    ['user' => $user, 'session' => $session] = makeSessionParticipant(
        workshopType: 'session_based',
        withSelection: true
    );
    expect($svc->isParticipantInSession($user, $session))->toBeTrue();
});

test('isParticipantInSession returns false when registered but not selected', function () {
    $svc = app(RoleContextService::class);
    ['user' => $user, 'session' => $session] = makeSessionParticipant(
        workshopType: 'session_based',
        withSelection: false
    );
    expect($svc->isParticipantInSession($user, $session))->toBeFalse();
});

// ─── isParticipantInSession() — event-based ───────────────

test('isParticipantInSession returns true for event-based workshop with just registration', function () {
    $svc = app(RoleContextService::class);
    ['user' => $user, 'session' => $session] = makeSessionParticipant(
        workshopType: 'event_based',
        withSelection: false // no selection needed for event_based
    );
    expect($svc->isParticipantInSession($user, $session))->toBeTrue();
});

// ─── isAssignedLeaderForSession() ─────────────────────────

test('isAssignedLeaderForSession returns true for accepted assignment', function () {
    $svc = app(RoleContextService::class);
    ['user' => $user, 'session' => $session] = rcsAssignedLeader('accepted');
    expect($svc->isAssignedLeaderForSession($user, $session))->toBeTrue();
});

test('isAssignedLeaderForSession returns false for pending assignment', function () {
    $svc = app(RoleContextService::class);
    ['user' => $user, 'session' => $session] = rcsAssignedLeader('pending');
    expect($svc->isAssignedLeaderForSession($user, $session))->toBeFalse();
});

test('isAssignedLeaderForSession returns false for non-assigned leader', function () {
    $svc = app(RoleContextService::class);
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);
    // No leader record for this user at all.
    expect($svc->isAssignedLeaderForSession($user, $session))->toBeFalse();
});

// ─── canManageSession() — cross-role Scenario D ───────────

test('canManageSession returns true for org admin even without session assignment', function () {
    // Scenario D: org admin has broader permissions than leader scope
    $svc = app(RoleContextService::class);
    $org = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'admin',
        'is_active' => true,
    ]);
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);

    expect($svc->canManageSession($user, $session))->toBeTrue();
});

test('canManageSession returns true for assigned leader', function () {
    $svc = app(RoleContextService::class);
    ['user' => $user, 'session' => $session] = rcsAssignedLeader('accepted');
    expect($svc->canManageSession($user, $session))->toBeTrue();
});

test('canManageSession returns false for unrelated user', function () {
    $svc = app(RoleContextService::class);
    $org = Organization::factory()->create();
    $user = User::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);

    expect($svc->canManageSession($user, $session))->toBeFalse();
});

// ─── allContexts() ────────────────────────────────────────

test('allContexts returns org roles and leader status', function () {
    $svc = app(RoleContextService::class);
    $user = User::factory()->create();
    $org = Organization::factory()->create();

    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $contexts = $svc->allContexts($user);

    expect($contexts['organization_roles'])->toHaveCount(1)
        ->and($contexts['organization_roles'][0]['role'])->toBe('admin')
        ->and($contexts['is_leader'])->toBeFalse()
        ->and($contexts['leader_id'])->toBeNull();
});

// ─── Helpers ──────────────────────────────────────────────

function makeOrgMember(string $role): array
{
    $org = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);

    return [$org, $user];
}

function makeSessionParticipant(string $workshopType, bool $withSelection): array
{
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'workshop_type' => $workshopType,
    ]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);
    $reg = Registration::factory()->create([
        'workshop_id' => $workshop->id,
        'user_id' => $user->id,
        'registration_status' => 'registered',
    ]);
    if ($withSelection) {
        SessionSelection::factory()->create([
            'registration_id' => $reg->id,
            'session_id' => $session->id,
            'selection_status' => 'selected',
        ]);
    }

    return compact('user', 'workshop', 'session', 'reg');
}

function rcsAssignedLeader(string $assignmentStatus): array
{
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);

    $leader = Leader::factory()->create(['user_id' => $user->id]);
    LeaderInvitation::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'accepted',
    ]);
    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => $assignmentStatus,
    ]);

    return compact('user', 'leader', 'session', 'workshop', 'org');
}
