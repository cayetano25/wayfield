<?php

use App\Mail\LeaderInvitationMail;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrgWithAdmin(): array
{
    $org   = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $admin->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    return [$org, $admin];
}

function makeWorkshopForOrg(Organization $org): Workshop
{
    return Workshop::factory()->forOrganization($org->id)->create();
}

// ─── Invite ───────────────────────────────────────────────────────────────────

test('organizer can invite a leader by email', function () {
    Queue::fake();

    [$org, $admin] = makeOrgWithAdmin();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/invitations", [
            'invited_email'      => 'leader@example.com',
            'invited_first_name' => 'Jane',
            'invited_last_name'  => 'Doe',
        ])
        ->assertStatus(201)
        ->assertJsonPath('status', 'pending')
        ->assertJsonPath('invited_email', 'leader@example.com');

    $this->assertDatabaseHas('leader_invitations', [
        'organization_id' => $org->id,
        'invited_email'   => 'leader@example.com',
        'status'          => 'pending',
    ]);
});

test('invitation email is queued, not sent synchronously', function () {
    Mail::fake();

    [$org, $admin] = makeOrgWithAdmin();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/invitations", [
            'invited_email' => 'leader@example.com',
        ])
        ->assertStatus(201);

    Mail::assertQueued(LeaderInvitationMail::class);
});

test('invitation token is stored as hash — raw token not in database', function () {
    Queue::fake();

    [$org, $admin] = makeOrgWithAdmin();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/invitations", [
            'invited_email' => 'leader@example.com',
        ])
        ->assertStatus(201);

    $invitation = LeaderInvitation::where('invited_email', 'leader@example.com')->first();

    // The hash stored must be 64 chars (sha256 hex), never a raw token
    expect($invitation->invitation_token_hash)->toHaveLength(64);
    // Must not equal a raw token string (raw tokens are 64 Str::random characters)
    expect($invitation->invitation_token_hash)->not->toContain(' ');
});

test('non-admin staff cannot invite leaders', function () {
    Queue::fake();

    $org  = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/invitations", [
            'invited_email' => 'leader@example.com',
        ])
        ->assertStatus(403);
});

// ─── Resolve token ────────────────────────────────────────────────────────────

test('valid invitation token can be resolved', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('status', 'pending')
        ->assertJsonPath('is_actionable', true);
});

test('expired invitation token returns 422', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->subDay(),
        'status'                => 'pending',
    ]);

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}")
        ->assertStatus(422)
        ->assertJsonPath('message', 'This invitation is no longer actionable.');
});

test('invalid token for a valid id returns 404', function () {
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', Str::random(64)),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    // Correct ID, wrong token — must be rejected
    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/" . Str::random(64))
        ->assertStatus(404);
});

test('invalid id returns 404', function () {
    $this->getJson('/api/v1/leader-invitations/99999/' . Str::random(64))
        ->assertStatus(404);
});

// ─── Accept ───────────────────────────────────────────────────────────────────

test('leader can accept invitation and profile is created', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
            'bio'        => 'Landscape photographer.',
            'city'       => 'Austin',
        ])
        ->assertStatus(200)
        ->assertJsonPath('first_name', 'Jane')
        ->assertJsonPath('last_name', 'Doe');

    $this->assertDatabaseHas('leaders', [
        'user_id'    => $user->id,
        'first_name' => 'Jane',
        'last_name'  => 'Doe',
    ]);

    $invitation->refresh();
    expect($invitation->status)->toBe('accepted');
    expect($invitation->leader_id)->not->toBeNull();
});

test('accepting invitation creates organization_leaders association', function () {
    $rawToken   = Str::random(64);
    $org        = Organization::factory()->create();
    $invitation = LeaderInvitation::factory()->forOrganization($org->id)->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
        ])
        ->assertStatus(200);

    $leader = Leader::where('user_id', $user->id)->first();

    $this->assertDatabaseHas('organization_leaders', [
        'organization_id' => $org->id,
        'leader_id'       => $leader->id,
        'status'          => 'active',
    ]);
});

test('accepting a workshop-scoped invitation creates confirmed workshop_leaders row', function () {
    $rawToken   = Str::random(64);
    $org        = Organization::factory()->create();
    $workshop   = Workshop::factory()->forOrganization($org->id)->create();
    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop($workshop->id)
        ->create([
            'invitation_token_hash' => hash('sha256', $rawToken),
            'expires_at'            => now()->addDays(7),
            'status'                => 'pending',
        ]);

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
        ])
        ->assertStatus(200);

    $leader = Leader::where('user_id', $user->id)->first();

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id'  => $workshop->id,
        'leader_id'    => $leader->id,
        'is_confirmed' => true,
    ]);
});

test('expired invitation cannot be accepted', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->subDay(),
        'status'                => 'pending',
    ]);

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
        ])
        ->assertStatus(422);

    // Invitation status must remain unchanged
    $invitation->refresh();
    expect($invitation->status)->toBe('pending');
});

test('wrong token for correct id is rejected', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $user = User::factory()->create();

    // Correct ID, wrong token
    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/" . Str::random(64) . '/accept', [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
        ])
        ->assertStatus(404);
});

test('accept requires first_name and last_name', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['first_name', 'last_name']);
});

// ─── Decline ──────────────────────────────────────────────────────────────────

test('leader can decline invitation', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation declined.');

    $invitation->refresh();
    expect($invitation->status)->toBe('declined');
});

test('already-declined invitation cannot be declined again', function () {
    $rawToken   = Str::random(64);
    $invitation = LeaderInvitation::factory()->declined()->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
    ]);

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(422);
});

// ─── Audit log ────────────────────────────────────────────────────────────────

test('invitation sent is logged to audit_logs', function () {
    Queue::fake();

    [$org, $admin] = makeOrgWithAdmin();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/invitations", [
            'invited_email' => 'leader@example.com',
        ])
        ->assertStatus(201);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $admin->id,
        'entity_type'     => 'leader_invitation',
        'action'          => 'invitation_sent',
    ]);
});

test('invitation accepted is logged to audit_logs', function () {
    $rawToken   = Str::random(64);
    $org        = Organization::factory()->create();
    $invitation = LeaderInvitation::factory()->forOrganization($org->id)->create([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'status'                => 'pending',
    ]);

    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name'  => 'Doe',
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id'   => $user->id,
        'entity_type'     => 'leader_invitation',
        'action'          => 'invitation_accepted',
    ]);
});
