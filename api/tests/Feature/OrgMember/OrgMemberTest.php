<?php

use App\Mail\InviteOrgMemberMail;
use App\Models\Organization;
use App\Models\OrganizationInvitation;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrgWithActor(string $actorRole): array
{
    $org = Organization::factory()->create();
    $actor = User::factory()->create();
    $actorMember = OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $actor->id,
        'role' => $actorRole,
        'is_active' => true,
    ]);

    return [$org, $actor, $actorMember];
}

function addMemberToOrg(Organization $org, string $role): OrganizationUser
{
    $user = User::factory()->create();

    return OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);
}

// ─── GET /members — list ──────────────────────────────────────────────────────

test('index returns active members with correct shape', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    addMemberToOrg($org, 'admin');
    addMemberToOrg($org, 'staff');

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(200)
        ->assertJsonStructure([
            'members' => [
                '*' => ['id', 'user' => ['id', 'first_name', 'last_name', 'email', 'profile_image_url'], 'role', 'is_active', 'joined_at'],
            ],
            'pending_invitations',
        ])
        ->assertJsonCount(3, 'members');
});

test('index does not include inactive members', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $inactive = addMemberToOrg($org, 'staff');
    $inactive->update(['is_active' => false]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(200)
        ->assertJsonCount(1, 'members'); // only the owner
});

test('index includes pending invitations', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    OrganizationInvitation::factory()->forOrganization($org->id)->count(2)->create([
        'status' => 'pending',
        'expires_at' => now()->addDays(7),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(200)
        ->assertJsonCount(2, 'pending_invitations');
});

test('index is allowed for staff', function () {
    [$org, $staff] = makeOrgWithActor('staff');

    $this->actingAs($staff, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(200);
});

test('index is denied for billing_admin', function () {
    [$org, $billingAdmin] = makeOrgWithActor('billing_admin');

    $this->actingAs($billingAdmin, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(403);
});

test('index is denied for unauthenticated requests', function () {
    $org = Organization::factory()->create();

    $this->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(401);
});

// ─── PATCH /members/{member} — change role ────────────────────────────────────

test('owner can change admin to staff', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $adminMember = addMemberToOrg($org, 'admin');

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$adminMember->id}", [
            'role' => 'staff',
        ])
        ->assertStatus(200)
        ->assertJsonPath('role', 'staff');

    $adminMember->refresh();
    expect($adminMember->role)->toBe('staff');
});

test('owner can change staff to billing_admin', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}", [
            'role' => 'billing_admin',
        ])
        ->assertStatus(200)
        ->assertJsonPath('role', 'billing_admin');
});

test('role change writes audit log', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $adminMember = addMemberToOrg($org, 'admin');

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$adminMember->id}", [
            'role' => 'staff',
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'organization_user',
        'action' => 'org_member_role_changed',
    ]);
});

test('owner cannot change the owner role', function () {
    [$org, $owner, $ownerMember] = makeOrgWithActor('owner');
    $otherOwnerMember = addMemberToOrg($org, 'owner');

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$otherOwnerMember->id}", [
            'role' => 'admin',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'cannot_change_owner');
});

test('owner cannot change their own role', function () {
    [$org, $owner, $ownerMember] = makeOrgWithActor('owner');

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$ownerMember->id}", [
            'role' => 'admin',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'cannot_change_own_role');
});

test('owner role cannot be assigned via this endpoint', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}", [
            'role' => 'owner',
        ])
        ->assertStatus(422); // blocked by validation rule
});

test('admin cannot change any role', function () {
    [$org, $admin] = makeOrgWithActor('admin');
    $staffMember = addMemberToOrg($org, 'staff');

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}", [
            'role' => 'billing_admin',
        ])
        ->assertStatus(403);
});

// ─── DELETE /members/{member} — remove member ─────────────────────────────────

test('owner can remove an admin', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $adminMember = addMemberToOrg($org, 'admin');

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$adminMember->id}")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Member removed.');

    $adminMember->refresh();
    expect($adminMember->is_active)->toBeFalse();
});

test('owner can remove a staff member', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}")
        ->assertStatus(200);

    $staffMember->refresh();
    expect($staffMember->is_active)->toBeFalse();
});

test('admin can remove a staff member', function () {
    [$org, $admin] = makeOrgWithActor('admin');
    $staffMember = addMemberToOrg($org, 'staff');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}")
        ->assertStatus(200);

    $staffMember->refresh();
    expect($staffMember->is_active)->toBeFalse();
});

test('admin cannot remove another admin', function () {
    [$org, $admin] = makeOrgWithActor('admin');
    $otherAdmin = addMemberToOrg($org, 'admin');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$otherAdmin->id}")
        ->assertStatus(403)
        ->assertJsonPath('error', 'insufficient_role');
});

test('admin cannot remove a billing_admin', function () {
    [$org, $admin] = makeOrgWithActor('admin');
    $billingAdmin = addMemberToOrg($org, 'billing_admin');

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$billingAdmin->id}")
        ->assertStatus(403)
        ->assertJsonPath('error', 'insufficient_role');
});

test('owner cannot remove themselves', function () {
    [$org, $owner, $ownerMember] = makeOrgWithActor('owner');

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$ownerMember->id}")
        ->assertStatus(422)
        ->assertJsonPath('error', 'cannot_remove_self');
});

test('owner cannot remove another owner', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $otherOwner = addMemberToOrg($org, 'owner');

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$otherOwner->id}")
        ->assertStatus(422)
        ->assertJsonPath('error', 'cannot_remove_owner');
});

test('removal writes audit log', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'organization_user',
        'action' => 'org_member_removed',
    ]);
});

test('removal is soft — row preserved with is_active = false', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');
    $memberId = $staffMember->id;

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('organization_users', ['id' => $memberId, 'is_active' => false]);
});

test('removed member cannot access org routes', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');
    $staffUser = $staffMember->user;

    // Remove the member.
    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}")
        ->assertStatus(200);

    // Removed member's subsequent request is denied.
    $this->actingAs($staffUser, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/members")
        ->assertStatus(403);
});

// ─── POST /invitations/{invitation}/resend ────────────────────────────────────

test('owner can resend a pending invitation', function () {
    Mail::fake();
    [$org, $owner] = makeOrgWithActor('owner');
    $rawToken = Str::random(64);
    $invitation = OrganizationInvitation::factory()->forOrganization($org->id)->create([
        'status' => 'pending',
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at' => now()->addDays(7),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}/resend")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation resent.')
        ->assertJsonStructure(['invitation_id', 'expires_at']);

    Mail::assertQueued(InviteOrgMemberMail::class, fn ($mail) => $mail->hasTo($invitation->invited_email));
});

test('resend refreshes an expired invitation', function () {
    Mail::fake();
    [$org, $owner] = makeOrgWithActor('owner');
    $rawToken = Str::random(64);
    $invitation = OrganizationInvitation::factory()->forOrganization($org->id)->create([
        'status' => 'pending',
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at' => now()->subDay(), // already expired
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}/resend")
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->expires_at->isFuture())->toBeTrue();
    expect($invitation->status)->toBe('pending');
    // Token should have changed.
    expect($invitation->invitation_token_hash)->not->toBe(hash('sha256', $rawToken));
});

test('cannot resend an accepted invitation', function () {
    Mail::fake();
    [$org, $owner] = makeOrgWithActor('owner');
    $invitation = OrganizationInvitation::factory()->forOrganization($org->id)->create([
        'status' => 'accepted',
        'responded_at' => now(),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}/resend")
        ->assertStatus(422);
});

test('resend pending invitation generates a new token', function () {
    Mail::fake();
    [$org, $owner] = makeOrgWithActor('owner');
    $rawToken = Str::random(64);
    $originalHash = hash('sha256', $rawToken);
    $invitation = OrganizationInvitation::factory()->forOrganization($org->id)->create([
        'status' => 'pending',
        'invitation_token_hash' => $originalHash,
        'expires_at' => now()->addDays(7),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}/resend")
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->invitation_token_hash)->not->toBe($originalHash);
});

test('removed member cannot access org workshops endpoint', function () {
    [$org, $owner] = makeOrgWithActor('owner');
    $staffMember = addMemberToOrg($org, 'staff');
    $staffUser = $staffMember->user;

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/members/{$staffMember->id}")
        ->assertStatus(200);

    // Removed member is denied access to workshop list.
    $this->actingAs($staffUser, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/workshops")
        ->assertStatus(403);
});
