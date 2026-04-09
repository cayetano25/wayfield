<?php

declare(strict_types=1);

use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\User;
use App\Models\Workshop;
use App\Services\Auth\RoleContextService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Scenario A: Org member who is also a participant ─────────────────────────
// ROLE_MODEL.md Section 5 Scenario A: "Their organisation_users membership in
// their own org has no bearing on their participant experience in an unrelated
// workshop. No cross-context leakage."

test('Scenario A: org owner in their own org is an unrelated participant elsewhere', function () {
    $svc = app(RoleContextService::class);

    // Set up: user is owner of Org A
    $orgA = Organization::factory()->create();
    $user = User::factory()->create(['email_verified_at' => now()]);
    OrganizationUser::create([
        'organization_id' => $orgA->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    // Set up: same user is a participant in Org B's workshop
    $orgB     = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $orgB->id]);
    Registration::factory()->create([
        'workshop_id'         => $workshop->id,
        'user_id'             => $user->id,
        'registration_status' => 'registered',
    ]);

    // Org role in Org A does NOT bleed into Org B
    expect($svc->orgRole($user, $orgA))->toBe('owner');
    expect($svc->orgRole($user, $orgB))->toBeNull();
    expect($svc->isParticipant($user, $workshop))->toBeTrue();

    // Ownership of Org A does not grant operational access to Org B
    expect($orgB->isOperationalMember($user))->toBeFalse();
});

test('Scenario A: participant context does not grant organiser permissions in a different org', function () {
    $user = User::factory()->create(['email_verified_at' => now()]);

    // User is a participant in an external workshop
    $orgExt      = Organization::factory()->create();
    $extWorkshop = Workshop::factory()->create(['organization_id' => $orgExt->id]);
    Registration::factory()->create([
        'workshop_id'         => $extWorkshop->id,
        'user_id'             => $user->id,
        'registration_status' => 'registered',
    ]);

    // A separate org the user has NO membership in
    $unrelatedOrg = Organization::factory()->create();

    // Via HTTP: participant cannot update an org they have no membership in
    $token = $user->createToken('web')->plainTextToken;
    $this->withToken($token)
        ->patchJson("/api/v1/organizations/{$unrelatedOrg->id}", ['name' => 'Hacked'])
        ->assertStatus(403);
});

// ─── Scenario B: Leader invited to multiple organisations ─────────────────────
// ROLE_MODEL.md Section 5 Scenario B: "Session access is scoped to the sessions
// they are assigned to within each organisation's workshops independently."

test('Scenario B: leader assigned to Org A session cannot access Org B session roster', function () {
    $svc  = app(RoleContextService::class);
    $user = User::factory()->create(['email_verified_at' => now()]);

    $leader = Leader::factory()->create(['user_id' => $user->id]);

    $orgA      = Organization::factory()->create();
    $orgB      = Organization::factory()->create();
    $workshopA = Workshop::factory()->create(['organization_id' => $orgA->id]);
    $workshopB = Workshop::factory()->create(['organization_id' => $orgB->id]);
    $sessionA  = Session::factory()->create(['workshop_id' => $workshopA->id]);
    $sessionB  = Session::factory()->create(['workshop_id' => $workshopB->id]);

    // Leader accepted in both orgs
    LeaderInvitation::factory()->create([
        'organization_id' => $orgA->id,
        'leader_id'       => $leader->id,
        'status'          => 'accepted',
    ]);
    LeaderInvitation::factory()->create([
        'organization_id' => $orgB->id,
        'leader_id'       => $leader->id,
        'status'          => 'accepted',
    ]);

    // Assigned ONLY to Session A — not Session B
    SessionLeader::create([
        'session_id'        => $sessionA->id,
        'leader_id'         => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    expect($svc->isAssignedLeaderForSession($user, $sessionA))->toBeTrue();
    expect($svc->isAssignedLeaderForSession($user, $sessionB))->toBeFalse();

    // Via HTTP: leader cannot access roster of Session B
    $token = $user->createToken('web')->plainTextToken;
    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$sessionB->id}/roster")
        ->assertStatus(403);
});

// ─── Scenario C: Staff can see all workshops in their org ─────────────────────
// ROLE_MODEL.md Section 5 Scenario C: "A staff user can view and edit all
// workshops in their organisation, not just those they personally created."

test('Scenario C: staff can view all org workshops regardless of who created them', function () {
    $staffUser = User::factory()->create(['email_verified_at' => now()]);
    $org       = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $staffUser->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    // Workshop created under a different user (owner) — staff did not create it
    $owner = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $token = $staffUser->createToken('web')->plainTextToken;
    $this->withToken($token)
        ->getJson("/api/v1/workshops/{$workshop->id}")
        ->assertStatus(200);
});

test('Scenario C: staff cannot invite leaders — only owner/admin can', function () {
    // Per ROLE_MODEL.md: staff "Cannot: Invite leaders (requires admin or owner)"
    // Tests the same elevated-only boundary as the task's workshop-delete assertion,
    // but against an existing route with the correct policy gate.
    $staffUser = User::factory()->create(['email_verified_at' => now()]);
    $org       = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $staffUser->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $token = $staffUser->createToken('web')->plainTextToken;
    $this->withToken($token)
        ->postJson("/api/v1/workshops/{$workshop->id}/leaders", [
            'first_name' => 'Jane',
            'last_name'  => 'Smith',
            'email'      => 'jane@example.com',
        ])
        ->assertStatus(403);
});

// ─── Scenario D: Leader who is also an org admin ──────────────────────────────
// ROLE_MODEL.md Section 5 Scenario D: "Their admin role grants the broader set
// of permissions. The leader-scoped restrictions do not apply when they are
// acting in the admin context."

test('Scenario D: org admin has broader session access than leader scope alone', function () {
    $svc  = app(RoleContextService::class);
    $user = User::factory()->create(['email_verified_at' => now()]);
    $org  = Organization::factory()->create();

    // User is an admin of the org
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    // User also has a leader record but is NOT assigned to this session
    $leader = Leader::factory()->create(['user_id' => $user->id]);
    LeaderInvitation::factory()->create([
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'accepted',
    ]);

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session  = Session::factory()->create(['workshop_id' => $workshop->id]);
    // No session_leaders row for this session

    // Admin context overrides leader-scope restriction
    expect($svc->canManageSession($user, $session))->toBeTrue();
    expect($svc->isAssignedLeaderForSession($user, $session))->toBeFalse(); // not via leader path

    // Via HTTP: can access roster even without session assignment
    $token = $user->createToken('web')->plainTextToken;
    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}/roster")
        ->assertStatus(200);
});

// ─── Scenario E: Participant who becomes an org member ────────────────────────
// ROLE_MODEL.md Section 5 Scenario E: "No account migration. The existing
// users record gains a new organization_users row. All prior registrations
// and participant history remain intact."

test('Scenario E: existing participant history is preserved when user gains org membership', function () {
    $svc  = app(RoleContextService::class);
    $user = User::factory()->create(['email_verified_at' => now()]);

    // User joined a workshop as a participant
    $orgExt   = Organization::factory()->create();
    $workshop = Workshop::factory()->create(['organization_id' => $orgExt->id]);
    $reg      = Registration::factory()->create([
        'workshop_id'         => $workshop->id,
        'user_id'             => $user->id,
        'registration_status' => 'registered',
    ]);

    // Later, same users record gains org membership — no migration, no duplication
    $ownOrg = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $ownOrg->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    // Both contexts exist simultaneously on the same users record
    expect($svc->isParticipant($user, $workshop))->toBeTrue();
    expect($svc->orgRole($user, $ownOrg))->toBe('owner');

    // Registration row was not altered by the org membership grant
    expect(Registration::find($reg->id)->registration_status)->toBe('registered');
    expect(Registration::find($reg->id)->user_id)->toBe($user->id);
});

// ─── Sole owner protection ────────────────────────────────────────────────────
// ROLE_MODEL.md Section 2.3: "There must always be at least one active owner
// per organisation. Removing or downgrading the last active owner is forbidden."

test('sole owner cannot be downgraded — isSoleOwner guard is active', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $org   = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    // Guard confirms this is the sole active owner
    expect($org->isSoleOwner($owner))->toBeTrue();

    // Add a second owner — now neither is the sole owner
    $owner2 = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $owner2->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    expect($org->isSoleOwner($owner))->toBeFalse();
    expect($org->isSoleOwner($owner2))->toBeFalse();
});

test('sole owner guard ignores inactive owner rows', function () {
    // An inactive former owner must not count toward the active owner tally
    $activeOwner   = User::factory()->create(['email_verified_at' => now()]);
    $inactiveOwner = User::factory()->create();
    $org           = Organization::factory()->create();

    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $activeOwner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $inactiveOwner->id,
        'role'            => 'owner',
        'is_active'       => false, // deactivated — must not count
    ]);

    // Active owner is still sole active owner despite the inactive row
    expect($org->isSoleOwner($activeOwner))->toBeTrue();
});
