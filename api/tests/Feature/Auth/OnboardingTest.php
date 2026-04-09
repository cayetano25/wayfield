<?php

use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create a fresh, unboarded user who is authenticated.
 */
function unboardedUser(): User
{
    return User::factory()->unboarded()->create();
}

/**
 * Create an org + owner membership + free subscription fixture.
 * Returns [$user, $org].
 */
function orgWithOwner(): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create(); // already onboarded by factory default

    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    Subscription::create([
        'organization_id' => $org->id,
        'plan_code'       => 'free',
        'status'          => 'active',
        'starts_at'       => now(),
        'ends_at'         => null,
    ]);

    return [$user, $org];
}

// ─── Onboarding status ────────────────────────────────────────────────────────

test('onboarding status endpoint returns correct step completion state', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->getJson('/api/v1/onboarding/status')
        ->assertOk()
        ->assertJsonPath('onboarding_completed', false)
        ->assertJsonPath('steps.account_basics', true)
        ->assertJsonPath('steps.profile', false)
        ->assertJsonPath('steps.intent', false);
});

test('status shows profile step complete after pronouns are saved', function () {
    $user = unboardedUser();
    $user->update(['pronouns' => 'They/them']);

    $this->actingAs($user)
        ->getJson('/api/v1/onboarding/status')
        ->assertOk()
        ->assertJsonPath('steps.profile', true);
});

// ─── Profile step (Step 2) ────────────────────────────────────────────────────

test('profile step saves pronouns correctly', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->patchJson('/api/v1/onboarding/profile', ['pronouns' => 'They/them'])
        ->assertOk()
        ->assertJsonPath('message', 'Profile updated.');

    expect($user->fresh()->pronouns)->toBe('They/them');
});

test('profile step with empty body does not fail', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->patchJson('/api/v1/onboarding/profile', [])
        ->assertOk();
});

test('profile step saves phone and timezone', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->patchJson('/api/v1/onboarding/profile', [
            'phone_number' => '+1 555 0100',
            'timezone'     => 'America/Chicago',
        ])->assertOk();

    $profile = $user->fresh()->profile;

    expect($profile->phone_number)->toBe('+1 555 0100');
    expect($profile->timezone)->toBe('America/Chicago');
});

test('profile step saves address and links it to user_profile', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->patchJson('/api/v1/onboarding/profile', [
            'address' => [
                'country_code'   => 'US',
                'address_line_1' => '123 Main St',
                'locality'       => 'Springfield',
                'administrative_area' => 'IL',
                'postal_code'    => '62701',
            ],
        ])->assertOk();

    $profile = $user->fresh()->profile;

    expect($profile->address_id)->not->toBeNull();

    $this->assertDatabaseHas('addresses', [
        'id'             => $profile->address_id,
        'address_line_1' => '123 Main St',
        'locality'       => 'Springfield',
    ]);
});

test('profile step address is optional — skipping it leaves address_id null', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->patchJson('/api/v1/onboarding/profile', ['pronouns' => 'He/him'])
        ->assertOk();

    expect($user->fresh()->profile->address_id)->toBeNull();
});

test('profile step rejects invalid timezone', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->patchJson('/api/v1/onboarding/profile', ['timezone' => 'Not/ATimezone'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['timezone']);
});

// ─── Complete step (Step 3 / intent) ─────────────────────────────────────────

test('onboarding complete with join_workshop intent creates registration', function () {
    $user     = unboardedUser();
    $workshop = Workshop::factory()->published()->create();

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', [
            'intent'    => 'join_workshop',
            'join_code' => $workshop->join_code,
        ])->assertOk();

    $this->assertDatabaseHas('registrations', [
        'workshop_id'         => $workshop->id,
        'user_id'             => $user->id,
        'registration_status' => 'registered',
    ]);

    expect($user->fresh()->hasCompletedOnboarding())->toBeTrue();
});

test('onboarding complete with join_workshop rejects invalid join_code', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', [
            'intent'    => 'join_workshop',
            'join_code' => 'BADCODE9',
        ])->assertNotFound();
});

test('onboarding complete with create_organization creates org and makes user owner', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', [
            'intent'            => 'create_organization',
            'organization_name' => 'My Photo Studio',
            'organization_slug' => 'my-photo-studio',
        ])->assertOk();

    $this->assertDatabaseHas('organizations', ['slug' => 'my-photo-studio']);
    $this->assertDatabaseHas('organization_users', [
        'user_id' => $user->id,
        'role'    => 'owner',
    ]);
    expect($user->fresh()->hasCompletedOnboarding())->toBeTrue();
});

test('create_organization rejects duplicate slug', function () {
    $user = unboardedUser();
    Organization::factory()->create(['slug' => 'taken-slug']);

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', [
            'intent'            => 'create_organization',
            'organization_name' => 'Another Studio',
            'organization_slug' => 'taken-slug',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['organization_slug']);
});

test('onboarding complete with accept_invitation links leader record and accepts invitation', function () {
    $user   = unboardedUser();
    $org    = Organization::factory()->create();
    $leader = Leader::factory()->create(['user_id' => null]);

    $rawToken = Str::random(40);
    $invitation = LeaderInvitation::factory()->create([
        'organization_id'      => $org->id,
        'leader_id'            => $leader->id,
        'status'               => 'pending',
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'           => now()->addDays(7),
    ]);

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', [
            'intent'           => 'accept_invitation',
            'invitation_token' => $rawToken,
        ])->assertOk();

    expect($leader->fresh()->user_id)->toBe($user->id);
    expect($invitation->fresh()->status)->toBe('accepted');
    expect($user->fresh()->hasCompletedOnboarding())->toBeTrue();
});

test('accept_invitation with invalid token still completes onboarding', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', [
            'intent'           => 'accept_invitation',
            'invitation_token' => 'invalid-token-value',
        ])->assertOk(); // graceful — still completes onboarding

    expect($user->fresh()->hasCompletedOnboarding())->toBeTrue();
});

test('onboarding complete with exploring marks onboarding done', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', ['intent' => 'exploring'])
        ->assertOk()
        ->assertJsonPath('redirect', '/dashboard');

    expect($user->fresh()->hasCompletedOnboarding())->toBeTrue();
});

test('complete requires a valid intent', function () {
    $user = unboardedUser();

    $this->actingAs($user)
        ->postJson('/api/v1/onboarding/complete', ['intent' => 'become_admin'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['intent']);
});

// ─── EnsureOnboardingComplete middleware ──────────────────────────────────────

test('onboarding middleware blocks dashboard access for incomplete onboarding', function () {
    [$owner, $org] = orgWithOwner();
    $owner->update(['onboarding_completed_at' => null]); // un-board the owner

    $this->actingAs($owner)
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertStatus(403)
        ->assertJsonPath('error', 'onboarding_required');
});

test('onboarding middleware allows dashboard access after onboarding is complete', function () {
    [$owner, $org] = orgWithOwner();
    // factory default sets onboarding_completed_at, so this user is already onboarded

    $this->actingAs($owner)
        ->getJson("/api/v1/organizations/{$org->id}/dashboard")
        ->assertOk();
});
