<?php

use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInvitation(array $overrides = []): array
{
    $rawToken = Str::random(64);
    $invitation = LeaderInvitation::factory()->create(array_merge([
        'invitation_token_hash' => hash('sha256', $rawToken),
        'invited_email' => 'leader@example.com',
        'expires_at' => now()->addDays(7),
        'status' => 'pending',
    ], $overrides));

    return [$invitation, $rawToken];
}

function makeInvitationWithWorkshop(array $overrides = []): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    $rawToken = Str::random(64);
    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop($workshop->id)
        ->create(array_merge([
            'invitation_token_hash' => hash('sha256', $rawToken),
            'invited_email' => 'leader@example.com',
            'expires_at' => now()->addDays(7),
            'status' => 'pending',
        ], $overrides));

    return [$invitation, $rawToken, $org, $workshop];
}

// ─── GET resolve endpoint ─────────────────────────────────────────────────────

test('resolve endpoint returns full invitation context including workshop', function () {
    [$invitation, $rawToken, $org, $workshop] = makeInvitationWithWorkshop();

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('invitation_id', $invitation->id)
        ->assertJsonPath('status', 'pending')
        ->assertJsonPath('is_expired', false)
        ->assertJsonPath('invited_email', 'leader@example.com')
        ->assertJsonStructure([
            'invitation_id',
            'status',
            'invited_email',
            'invited_first_name',
            'invited_last_name',
            'expires_at',
            'is_expired',
            'organization' => ['id', 'name', 'slug'],
            'workshop' => [
                'id', 'title', 'description',
                'start_date', 'end_date', 'timezone', 'status',
                'location' => ['city', 'state_or_region'],
                'leaders_count', 'sessions_count',
            ],
            'sessions_assigned',
        ])
        ->assertJsonPath('organization.id', $org->id)
        ->assertJsonPath('workshop.id', $workshop->id);
});

test('resolve endpoint returns is_expired true for expired invitation', function () {
    [$invitation, $rawToken] = makeInvitation([
        'expires_at' => now()->subDay(),
        'status' => 'pending',
    ]);

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('is_expired', true)
        ->assertJsonPath('status', 'expired');
});

test('resolve endpoint returns 404 for invalid token', function () {
    [$invitation] = makeInvitation();

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/".Str::random(64))
        ->assertStatus(404)
        ->assertJsonPath('error', 'invitation_not_found');
});

test('resolve endpoint returns current status for already-accepted invitation', function () {
    [$invitation, $rawToken] = makeInvitation(['status' => 'accepted', 'responded_at' => now()]);

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('status', 'accepted')
        ->assertJsonPath('is_expired', false);
});

test('resolve endpoint returns null workshop for org-level invitation', function () {
    [$invitation, $rawToken] = makeInvitation(['workshop_id' => null]);

    $this->getJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}")
        ->assertStatus(200)
        ->assertJsonPath('workshop', null);
});

// ─── GET check-email ──────────────────────────────────────────────────────────

test('check-email returns account_exists true for existing email', function () {
    User::factory()->create(['email' => 'existing@example.com']);

    $this->getJson('/api/v1/auth/check-email?email=existing@example.com')
        ->assertStatus(200)
        ->assertJsonPath('email', 'existing@example.com')
        ->assertJsonPath('account_exists', true);
});

test('check-email returns account_exists false for unknown email', function () {
    $this->getJson('/api/v1/auth/check-email?email=nobody@example.com')
        ->assertStatus(200)
        ->assertJsonPath('account_exists', false);
});

test('check-email normalises email to lowercase', function () {
    User::factory()->create(['email' => 'user@example.com']);

    $this->getJson('/api/v1/auth/check-email?email=USER@EXAMPLE.COM')
        ->assertStatus(200)
        ->assertJsonPath('email', 'user@example.com')
        ->assertJsonPath('account_exists', true);
});

test('check-email returns 422 for missing email param', function () {
    $this->getJson('/api/v1/auth/check-email')
        ->assertStatus(422);
});

test('check-email is rate limited after 10 requests', function () {
    // Laravel's throttle middleware returns 429 after the limit is hit.
    // In testing with RefreshDatabase, the rate limiter cache may persist between
    // attempts within the same request cycle, so we hit it 11 times.
    for ($i = 0; $i <= 10; $i++) {
        $response = $this->getJson('/api/v1/auth/check-email?email=test@example.com');
    }

    $response->assertStatus(429);
});

// ─── POST accept ─────────────────────────────────────────────────────────────

test('accept requires authenticated user', function () {
    [$invitation, $rawToken] = makeInvitation();

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
        'first_name' => 'Jane',
        'last_name' => 'Doe',
    ])->assertStatus(401);
});

test('accept succeeds when user email matches invited_email', function () {
    [$invitation, $rawToken] = makeInvitation(['invited_email' => 'jane@example.com']);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation accepted.')
        ->assertJsonPath('leader.first_name', 'Jane')
        ->assertJsonPath('leader.last_name', 'Doe')
        ->assertJsonPath('redirect', '/leader/dashboard');
});

test('accept returns 403 when logged-in user email does not match invited_email', function () {
    [$invitation, $rawToken] = makeInvitation(['invited_email' => 'jane@example.com']);
    $wrongUser = User::factory()->create(['email' => 'someone.else@example.com']);

    $this->actingAs($wrongUser, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(403)
        ->assertJsonPath('error', 'email_mismatch');
});

test('accept creates leader record when none exists', function () {
    [$invitation, $rawToken] = makeInvitation(['invited_email' => 'jane@example.com']);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    expect(Leader::where('user_id', $user->id)->exists())->toBeFalse();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200);

    expect(Leader::where('user_id', $user->id)->exists())->toBeTrue();
});

test('accept links existing leader record to user', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitation([
        'organization_id' => $org->id,
        'invited_email' => 'jane@example.com',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    // Create an existing leader record linked to this user
    $existingLeader = Leader::factory()->create([
        'user_id' => $user->id,
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane@example.com',
    ]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200)
        ->assertJsonPath('leader.id', $existingLeader->id);

    // No duplicate leader record created
    expect(Leader::where('user_id', $user->id)->count())->toBe(1);
});

test('accept creates organization_leaders row', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitation([
        'organization_id' => $org->id,
        'invited_email' => 'jane@example.com',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200);

    $leader = Leader::where('user_id', $user->id)->firstOrFail();

    expect(
        OrganizationLeader::where('organization_id', $org->id)
            ->where('leader_id', $leader->id)
            ->exists()
    )->toBeTrue();
});

test('accept creates workshop_leaders row when workshop_id is set', function () {
    [$invitation, $rawToken, $org, $workshop] = makeInvitationWithWorkshop([
        'invited_email' => 'jane@example.com',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200);

    $leader = Leader::where('user_id', $user->id)->firstOrFail();

    $this->assertDatabaseHas('workshop_leaders', [
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
        'is_confirmed' => true,
    ]);
});

test('accept updates invitation status to accepted', function () {
    [$invitation, $rawToken] = makeInvitation(['invited_email' => 'jane@example.com']);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->status)->toBe('accepted');
    expect($invitation->responded_at)->not->toBeNull();
});

test('accept writes audit log entry', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitation([
        'organization_id' => $org->id,
        'invited_email' => 'jane@example.com',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'actor_user_id' => $user->id,
        'entity_type' => 'leader_invitation',
        'action' => 'invitation_accepted',
    ]);
});

test('accept returns 422 for already-accepted invitation', function () {
    [$invitation, $rawToken] = makeInvitation([
        'invited_email' => 'jane@example.com',
        'status' => 'accepted',
        'responded_at' => now(),
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(422);
});

test('accept returns 422 for expired invitation', function () {
    [$invitation, $rawToken] = makeInvitation([
        'invited_email' => 'jane@example.com',
        'expires_at' => now()->subDay(),
        'status' => 'pending',
    ]);
    $user = User::factory()->create(['email' => 'jane@example.com']);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/accept", [
            'first_name' => 'Jane',
            'last_name' => 'Doe',
        ])
        ->assertStatus(422);
});

// ─── POST decline ─────────────────────────────────────────────────────────────

test('decline succeeds without authentication', function () {
    [$invitation, $rawToken] = makeInvitation();

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation declined.');
});

test('decline updates status to declined', function () {
    [$invitation, $rawToken] = makeInvitation();

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(200);

    $invitation->refresh();
    expect($invitation->status)->toBe('declined');
    expect($invitation->responded_at)->not->toBeNull();
});

test('decline writes audit log entry', function () {
    $org = Organization::factory()->create();
    [$invitation, $rawToken] = makeInvitation(['organization_id' => $org->id]);

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(200);

    $this->assertDatabaseHas('audit_logs', [
        'organization_id' => $org->id,
        'entity_type' => 'leader_invitation',
        'action' => 'invitation_declined',
    ]);
});

test('decline returns 422 for already-accepted invitation', function () {
    [$invitation, $rawToken] = makeInvitation([
        'status' => 'accepted',
        'responded_at' => now(),
    ]);

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(422);
});

test('decline is allowed for expired invitation', function () {
    // Per spec: expired invitations may still be declined.
    // `isActionable()` returns false for expired, but decline must still work.
    [$invitation, $rawToken] = makeInvitation([
        'expires_at' => now()->subDay(),
        'status' => 'pending',
    ]);

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(200)
        ->assertJsonPath('message', 'Invitation declined.');

    $invitation->refresh();
    expect($invitation->status)->toBe('declined');
});

test('decline response includes organization_name and workshop_title', function () {
    [$invitation, $rawToken, $org, $workshop] = makeInvitationWithWorkshop();

    $this->postJson("/api/v1/leader-invitations/{$invitation->id}/{$rawToken}/decline")
        ->assertStatus(200)
        ->assertJsonPath('organization_name', $org->name)
        ->assertJsonPath('workshop_title', $workshop->title);
});
