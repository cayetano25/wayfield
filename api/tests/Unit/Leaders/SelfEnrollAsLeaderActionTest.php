<?php

declare(strict_types=1);

use App\Domain\Leaders\Actions\SelfEnrollAsLeaderAction;
use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── Fixture ──────────────────────────────────────────────────────────────────

function seaOrg(): array
{
    $org = Organization::factory()->create();
    $owner = User::factory()->create([
        'first_name' => 'Jane',
        'last_name'  => 'Photo',
    ]);
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    return [$org, $owner];
}

// ─── Leader record creation ────────────────────────────────────────────────────

test('enroll() creates a leaders row with user_id set to the authenticated user', function () {
    [$org, $owner] = seaOrg();

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null);

    $this->assertDatabaseHas('leaders', ['user_id' => $owner->id]);
});

test('enroll() seeds first_name and last_name from the user account, not from profileData', function () {
    [$org, $owner] = seaOrg();

    // Pass a different first_name in profileData — must be ignored
    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null, [
        'first_name' => 'ShouldBeIgnored',
        'last_name'  => 'AlsoIgnored',
        'bio'        => 'Real bio.',
    ]);

    $leader = Leader::where('user_id', $owner->id)->first();

    expect($leader->first_name)->toBe($owner->first_name);
    expect($leader->last_name)->toBe($owner->last_name);
    expect($leader->first_name)->not->toBe('ShouldBeIgnored');
});

test('enroll() with bio and city in profileData updates those fields on the leader', function () {
    [$org, $owner] = seaOrg();

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null, [
        'bio'  => 'Landscape and portrait.',
        'city' => 'Portland',
    ]);

    $leader = Leader::where('user_id', $owner->id)->first();

    expect($leader->bio)->toBe('Landscape and portrait.');
    expect($leader->city)->toBe('Portland');
});

test('enroll() called twice for the same user creates only one leaders row', function () {
    [$org, $owner] = seaOrg();

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null);
    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null);

    expect(Leader::where('user_id', $owner->id)->count())->toBe(1);
});

test('enroll() reuses an existing leaders row from another org and creates a new organization_leaders row', function () {
    [$orgA, $owner] = seaOrg();

    $orgB = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $orgB->id,
        'user_id'         => $owner->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    // Enroll in org A — creates the leader record
    $leaderFirst = app(SelfEnrollAsLeaderAction::class)->enroll($owner, $orgA, null);

    // Enroll in org B — must reuse same leader record
    $leaderSecond = app(SelfEnrollAsLeaderAction::class)->enroll($owner, $orgB, null);

    expect(Leader::where('user_id', $owner->id)->count())->toBe(1);
    expect($leaderFirst->id)->toBe($leaderSecond->id);

    // Both org associations must exist
    expect(OrganizationLeader::where('leader_id', $leaderFirst->id)->count())->toBe(2);
});

// ─── Organization link ────────────────────────────────────────────────────────

test('enroll() creates an organization_leaders row with status="active"', function () {
    [$org, $owner] = seaOrg();

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);
});

// ─── Workshop link ────────────────────────────────────────────────────────────

test('enroll() with a workshop creates a workshop_leaders row with is_confirmed=true and invitation_id=null', function () {
    [$org, $owner] = seaOrg();
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, $workshop);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id'   => $workshop->id,
        'leader_id'     => $leader->id,
        'is_confirmed'  => true,
        'invitation_id' => null,
    ]);
});

test('enroll() without a workshop does NOT create any workshop_leaders row', function () {
    [$org, $owner] = seaOrg();

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null);

    expect(WorkshopLeader::count())->toBe(0);
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('enroll() writes an audit_logs row with action="owner_self_enrolled_as_leader"', function () {
    [$org, $owner] = seaOrg();

    app(SelfEnrollAsLeaderAction::class)->enroll($owner, $org, null);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $owner->id,
        'entity_type'     => 'leader',
        'entity_id'       => $leader->id,
        'action'          => 'owner_self_enrolled_as_leader',
    ]);
});

// ─── Authorization ────────────────────────────────────────────────────────────

test('enroll() throws AuthorizationException when the caller is not owner or admin', function () {
    $org = Organization::factory()->create();
    $staff = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $staff->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    expect(fn () => app(SelfEnrollAsLeaderAction::class)->enroll($staff, $org, null))
        ->toThrow(AuthorizationException::class);
});

test('enroll() throws AuthorizationException for a user with no membership in the org', function () {
    $org = Organization::factory()->create();
    $outsider = User::factory()->create();

    expect(fn () => app(SelfEnrollAsLeaderAction::class)->enroll($outsider, $org, null))
        ->toThrow(AuthorizationException::class);
});
