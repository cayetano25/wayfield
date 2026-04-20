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

function makeOrgForInviteTest(string $role): array
{
    $org = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);

    return [$org, $user];
}

function makeInvitationWithToken(array $overrides = []): array
{
    $rawToken = Str::random(64);
    $invitation = OrganizationInvitation::factory()->create(array_merge([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at' => now()->addDays(7),
        'status' => 'pending',
    ], $overrides));

    return [$invitation, $rawToken];
}

// ─── POST store — send invitation ─────────────────────────────────────────────

test('owner can send an invitation to a new email', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'newmember@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(201)
        ->assertJsonPath('message', 'Invitation sent.')
        ->assertJsonStructure(['invitation_id']);

    $this->assertDatabaseHas('organization_invitations', [
        'organization_id' => $org->id,
        'invited_email' => 'newmember@example.com',
        'role' => 'staff',
        'status' => 'pending',
    ]);
});

test('admin can send invitation for staff role', function () {
    Mail::fake();
    [$org, $admin] = makeOrgForInviteTest('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'staffer@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(201);
});

test('admin cannot send invitation for billing_admin role', function () {
    // Per ROLE_MODEL.md §2.3: admin may only invite staff.
    Mail::fake();
    [$org, $admin] = makeOrgForInviteTest('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'billing@example.com',
            'role' => 'billing_admin',
        ])
        ->assertStatus(403)
        ->assertJsonPath('error', 'insufficient_role');
});

test('admin cannot send invitation for owner role', function () {
    Mail::fake();
    [$org, $admin] = makeOrgForInviteTest('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'someone@example.com',
            'role' => 'owner',
        ])
        // 'owner' is not in the allowed role enum — validation rejects it.
        ->assertStatus(422);
});

test('admin cannot send invitation for admin role', function () {
    // Per ROLE_MODEL.md: only owner can invite another admin.
    Mail::fake();
    [$org, $admin] = makeOrgForInviteTest('admin');

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'newadmin@example.com',
            'role' => 'admin',
        ])
        ->assertStatus(403)
        ->assertJsonPath('error', 'insufficient_role');
});

test('staff cannot send any invitation', function () {
    Mail::fake();
    [$org, $staff] = makeOrgForInviteTest('staff');

    $this->actingAs($staff, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'someone@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(403);
});

test('duplicate pending invitation returns 422', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    // Create a pending invitation for this email already.
    OrganizationInvitation::factory()->forOrganization($org->id)->create([
        'invited_email' => 'person@example.com',
        'status' => 'pending',
        'expires_at' => now()->addDays(7),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'person@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'invitation_pending');
});

test('invitation to existing member returns 422', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    // Create an active member with this email.
    $existingUser = User::factory()->create(['email' => 'existing@example.com']);
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $existingUser->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'existing@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(422)
        ->assertJsonPath('error', 'already_a_member');
});

test('invitation email is queued after store', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'queued@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(201);

    Mail::assertQueued(InviteOrgMemberMail::class, fn ($mail) => $mail->hasTo('queued@example.com'));
});

// ─── GET show — resolve token ─────────────────────────────────────────────────

test('resolve endpoint returns correct org and role information', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitationWithToken([
        'organization_id' => $org->id,
        'role' => 'admin',
    ]);

    $this->getJson("/api/v1/org-invitations/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('invitation_id', $invitation->id)
        ->assertJsonPath('role', 'admin')
        ->assertJsonPath('role_display', 'Administrator')
        ->assertJsonPath('is_expired', false)
        ->assertJsonPath('organization.id', $org->id)
        ->assertJsonStructure([
            'invitation_id', 'status', 'is_expired',
            'invited_email', 'role', 'role_display',
            'organization' => ['id', 'name', 'slug', 'workshops_count', 'members_count'],
        ]);
});

test('resolve returns is_expired true for expired invitation', function () {
    [$invitation, $rawToken] = makeInvitationWithToken(['expires_at' => now()->subDay()]);

    $this->getJson("/api/v1/org-invitations/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('is_expired', true);
});

test('resolve returns 404 for invalid token', function () {
    $this->getJson('/api/v1/org-invitations/'.Str::random(64))
        ->assertStatus(404)
        ->assertJsonPath('error', 'invitation_not_found');
});

// ─── POST accept ─────────────────────────────────────────────────────────────

test('accept creates organization_users row with correct role', function () {
    [$invitation, $rawToken] = makeInvitationWithToken([
        'invited_email' => 'jane@example.com',
        'role' => 'staff',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(200)
        ->assertJsonPath('role', 'staff')
        ->assertJsonPath('role_display', 'Staff');

    $this->assertDatabaseHas('organization_users', [
        'organization_id' => $invitation->organization_id,
        'user_id' => $user->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    $invitation->refresh();
    expect($invitation->status)->toBe('accepted');
    expect($invitation->responded_at)->not->toBeNull();
});

test('accept returns 403 when logged-in user email does not match', function () {
    [$invitation, $rawToken] = makeInvitationWithToken(['invited_email' => 'jane@example.com']);
    $wrongUser = User::factory()->create(['email' => 'wrong@example.com']);

    $this->actingAs($wrongUser, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(403)
        ->assertJsonPath('error', 'email_mismatch');
});

test('accept returns 422 for already-accepted invitation', function () {
    [$invitation, $rawToken] = makeInvitationWithToken([
        'invited_email' => 'jane@example.com',
        'status' => 'accepted',
        'responded_at' => now(),
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(422);
});

test('accept returns 422 for expired invitation', function () {
    [$invitation, $rawToken] = makeInvitationWithToken([
        'invited_email' => 'jane@example.com',
        'expires_at' => now()->subDay(),
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(422);
});

test('accept requires authentication', function () {
    [$invitation, $rawToken] = makeInvitationWithToken();

    $this->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(401);
});

test('accept writes audit log', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitationWithToken([
        'organization_id' => $org->id,
        'invited_email' => 'jane@example.com',
        'role' => 'staff',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $user->id,
        'entity_type' => 'organization_invitation',
        'action' => 'org_invitation.accepted',
    ]);
});

// ─── POST decline ─────────────────────────────────────────────────────────────

test('decline succeeds without authentication', function () {
    [$invitation, $rawToken] = makeInvitationWithToken();

    $this->postJson("/api/v1/org-invitations/{$rawToken}/decline")
        ->assertStatus(200)
        ->assertJsonPath('message', 'You have declined the invitation.')
        ->assertJsonStructure(['organization_name']);
});

test('decline updates status to declined', function () {
    [$invitation, $rawToken] = makeInvitationWithToken();

    $this->postJson("/api/v1/org-invitations/{$rawToken}/decline")
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->status)->toBe('declined');
    expect($invitation->responded_at)->not->toBeNull();
});

// ─── DELETE destroy — cancel invitation ───────────────────────────────────────

test('owner can cancel a pending invitation', function () {
    [$org, $owner] = makeOrgForInviteTest('owner');
    [$invitation] = makeInvitationWithToken(['organization_id' => $org->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation cancelled.');

    $invitation->refresh();
    expect($invitation->status)->toBe('removed');
});

test('cannot cancel an already-accepted invitation', function () {
    [$org, $owner] = makeOrgForInviteTest('owner');
    [$invitation] = makeInvitationWithToken([
        'organization_id' => $org->id,
        'status' => 'accepted',
        'responded_at' => now(),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}")
        ->assertStatus(422);
});

test('staff cannot cancel invitations', function () {
    [$org, $staff] = makeOrgForInviteTest('staff');
    [$invitation] = makeInvitationWithToken(['organization_id' => $org->id]);

    $this->actingAs($staff, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}")
        ->assertStatus(403);
});

// ─── GET index — list invitations ─────────────────────────────────────────────

test('index lists pending and recent invitations for owner', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    OrganizationInvitation::factory()->forOrganization($org->id)->count(3)->create([
        'status' => 'pending',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/invitations")
        ->assertStatus(200)
        ->assertJsonCount(3);
});

test('index is denied for staff', function () {
    [$org, $staff] = makeOrgForInviteTest('staff');

    $this->actingAs($staff, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/invitations")
        ->assertStatus(403);
});

// ─── Additional role coverage ──────────────────────────────────────────────────

test('owner can invite admin', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'newadmin@example.com',
            'role' => 'admin',
        ])
        ->assertStatus(201);
});

test('owner can invite billing_admin', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'billing@example.com',
            'role' => 'billing_admin',
        ])
        ->assertStatus(201);
});

test('billing_admin cannot send any invitation', function () {
    Mail::fake();
    [$org, $billingAdmin] = makeOrgForInviteTest('billing_admin');

    $this->actingAs($billingAdmin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'someone@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(403);
});

test('user_id is set on invitation when invitee already has an account', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');
    $existingUser = User::factory()->create(['email' => 'known@example.com']);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'known@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('organization_invitations', [
        'invited_email' => 'known@example.com',
        'user_id' => $existingUser->id,
    ]);
});

test('user_id is null on invitation when invitee has no account', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'unknown@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('organization_invitations', [
        'invited_email' => 'unknown@example.com',
        'user_id' => null,
    ]);
});

test('accept stamps user_id on the invitation record', function () {
    [$invitation, $rawToken] = makeInvitationWithToken([
        'invited_email' => 'jane@example.com',
        'role' => 'staff',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->user_id)->toBe($user->id);
});

test('rescind stamps responded_at on the invitation record', function () {
    [$org, $owner] = makeOrgForInviteTest('owner');
    [$invitation] = makeInvitationWithToken(['organization_id' => $org->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}")
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->responded_at)->not->toBeNull();
});

test('admin cannot rescind an admin-role invitation', function () {
    [$org, $admin] = makeOrgForInviteTest('admin');
    [$invitation] = makeInvitationWithToken([
        'organization_id' => $org->id,
        'role' => 'admin',
    ]);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}")
        ->assertStatus(403)
        ->assertJsonPath('error', 'insufficient_role');
});

test('store writes audit log', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations", [
            'invited_email' => 'audited@example.com',
            'role' => 'staff',
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'organization_invitation',
        'action' => 'org_invitation.sent',
    ]);
});

test('decline writes audit log', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitationWithToken([
        'organization_id' => $org->id,
        'invited_email' => 'declining@example.com',
    ]);

    $this->postJson("/api/v1/org-invitations/{$rawToken}/decline")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'entity_type' => 'organization_invitation',
        'action' => 'org_invitation.declined',
    ]);
});

test('rescind writes audit log', function () {
    [$org, $owner] = makeOrgForInviteTest('owner');
    [$invitation] = makeInvitationWithToken(['organization_id' => $org->id]);

    $this->actingAs($owner, 'sanctum')
        ->deleteJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'organization_invitation',
        'action' => 'org_invitation.cancelled',
    ]);
});

test('accept returns 422 when user is already an active member', function () {
    $org = Organization::factory()->create();

    // User is already an active member of the org.
    $user = User::factory()->create(['email' => 'existing@example.com']);
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    // A pending invitation exists for their email.
    [$invitation, $rawToken] = makeInvitationWithToken([
        'organization_id' => $org->id,
        'invited_email' => 'existing@example.com',
        'role' => 'admin',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/org-invitations/{$rawToken}/accept")
        ->assertStatus(422)
        ->assertJsonPath('error', 'already_a_member');
});

test('resend writes audit log', function () {
    Mail::fake();
    [$org, $owner] = makeOrgForInviteTest('owner');
    $rawToken = Str::random(64);
    $invitation = OrganizationInvitation::factory()->forOrganization($org->id)->create([
        'status' => 'pending',
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at' => now()->addDays(7),
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/invitations/{$invitation->id}/resend")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $owner->id,
        'entity_type' => 'organization_invitation',
        'action' => 'org_invitation.resent',
    ]);
});
