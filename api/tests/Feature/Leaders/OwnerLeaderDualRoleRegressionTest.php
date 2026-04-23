<?php

use App\Domain\Notifications\Services\EnforceLeaderMessagingRulesService;
use App\Exceptions\LeaderMessagingDeniedException;
use App\Http\Resources\OrganizerLeaderResource;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function oldrOwnerOrg(): array
{
    $org = Organization::factory()->create();
    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    return [$org, $owner];
}

function oldrWorkshop(Organization $org): Workshop
{
    return Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => 'UTC']);
}

// ─── Organizer access retained after self-enrollment ──────────────────────────

test('owner enrolled as leader retains their organization_users row and can still access organizer endpoints', function () {
    [$org, $owner] = oldrOwnerOrg();
    oldrWorkshop($org);

    // Self-enroll as leader
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    // Must still be able to list workshops (organizer endpoint)
    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/workshops")
        ->assertStatus(200);

    // Must still be able to create a workshop
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", [
            'title'          => 'New Workshop',
            'description'    => 'Test.',
            'workshop_type'  => 'session_based',
            'timezone'       => 'America/New_York',
            'start_date'     => now()->addMonth()->toDateString(),
            'end_date'       => now()->addMonth()->addDays(3)->toDateString(),
        ])
        ->assertStatus(201);

    // organization_users row must still be intact
    $this->assertDatabaseHas('organization_users', [
        'organization_id' => $org->id,
        'user_id'         => $owner->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);
});

// ─── Messaging time-window constraint applies to self-enrolled leaders ─────────

test('owner enrolled as leader and assigned to a session is subject to time-window constraints', function () {
    [$org, $owner] = oldrOwnerOrg();

    Subscription::factory()->forOrganization($org->id)->starter()->active()->create();

    $workshop = oldrWorkshop($org);

    // Session that ended 3 hours ago — window is now CLOSED
    $session = Session::factory()->forWorkshop($workshop->id)->published()->create([
        'start_at' => now()->subHours(5)->toDateTimeString(),
        'end_at'   => now()->subHours(3)->toDateTimeString(),
    ]);

    // Self-enroll as leader
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    // Assign them to the session
    SessionLeader::create([
        'session_id'        => $session->id,
        'leader_id'         => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    // Attempt to notify — window is closed, must be rejected
    $service = app(EnforceLeaderMessagingRulesService::class);

    expect(fn () => $service->validate($owner, $session))
        ->toThrow(LeaderMessagingDeniedException::class);
});

// ─── Public leader listing ────────────────────────────────────────────────────

test('self-enrolled leader with is_confirmed=true appears in the public workshop leaders list', function () {
    [$org, $owner] = oldrOwnerOrg();

    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->create([
            'public_page_enabled' => true,
            'public_slug'         => 'regression-workshop-slug',
        ]);

    // Self-enroll the owner as leader for this workshop
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll", [
            'workshop_id' => $workshop->id,
        ])
        ->assertStatus(201);

    $leader = Leader::where('user_id', $owner->id)->firstOrFail();

    // workshop_leaders.is_confirmed must be true for the leader to appear publicly
    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id'  => $workshop->id,
        'leader_id'    => $leader->id,
        'is_confirmed' => true,
    ]);

    // Public endpoint must include the leader
    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $leaderIds = collect($response->json('leaders'))->pluck('id')->toArray();
    expect($leaderIds)->toContain($leader->id);
});

// ─── is_self_enrolled resource field ─────────────────────────────────────────

test('OrganizerLeaderResource returns is_self_enrolled=true when user_id is set and invitation_id is absent', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->linkedToUser($user)->create();

    $resource = new OrganizerLeaderResource($leader);
    $resolved = $resource->resolve(request());

    expect($resolved['is_self_enrolled'])->toBeTrue();
});

test('OrganizerLeaderResource returns is_self_enrolled=false when invitation_id is present on the model', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->linkedToUser($user)->create();

    // Simulate the invitation_id attribute being present (as it would be if the
    // model were loaded through the workshop_leaders pivot with withPivot(['invitation_id'])).
    $leader->setAttribute('invitation_id', 999);

    $resource = new OrganizerLeaderResource($leader);
    $resolved = $resource->resolve(request());

    expect($resolved['is_self_enrolled'])->toBeFalse();
});

test('OrganizerLeaderResource returns is_self_enrolled=false when user_id is null (unlinked placeholder leader)', function () {
    $leader = Leader::factory()->create(['user_id' => null]);

    $resource = new OrganizerLeaderResource($leader);
    $resolved = $resource->resolve(request());

    expect($resolved['is_self_enrolled'])->toBeFalse();
});

// ─── Invitation flow regression ───────────────────────────────────────────────

test('the existing invitation → acceptance flow continues to work correctly alongside self-enrollment', function () {
    // Set up org with admin
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $admin->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    $workshop = Workshop::factory()->forOrganization($org->id)->create();

    // Admin self-enrolls — this is the new feature
    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/self-enroll")
        ->assertStatus(201);

    // Now run a full invitation flow for a different leader
    $rawToken = Str::random(64);
    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop($workshop->id)
        ->create([
            'invitation_token_hash' => hash('sha256', $rawToken),
            'invited_email'         => 'invited@example.com',
            'expires_at'            => now()->addDays(7),
            'status'                => 'pending',
            'created_by_user_id'    => $admin->id,
        ]);

    $invitedUser = User::factory()->create(['email' => 'invited@example.com']);

    // Accept the invitation
    $this->actingAs($invitedUser, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$rawToken}/accept", [
            'first_name' => 'Invited',
            'last_name'  => 'Leader',
        ])
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation accepted.');

    // Verify all expected records were created for the invited leader
    $this->assertDatabaseHas('leaders', ['user_id' => $invitedUser->id]);

    $invitedLeader = Leader::where('user_id', $invitedUser->id)->first();

    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $invitedLeader->id,
        'status'          => 'active',
    ]);

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id'  => $workshop->id,
        'leader_id'    => $invitedLeader->id,
        'is_confirmed' => true,
    ]);

    $invitation->refresh();
    expect($invitation->status)->toBe('accepted');
    expect($invitation->leader_id)->toBe($invitedLeader->id);

    // The admin's own self-enrollment must be unaffected — two distinct leader records
    expect(Leader::where('user_id', $admin->id)->exists())->toBeTrue();
    expect(Leader::count())->toBe(2);
    expect(OrganizationLeader::where('organization_id', $org->id)->count())->toBe(2);
});
