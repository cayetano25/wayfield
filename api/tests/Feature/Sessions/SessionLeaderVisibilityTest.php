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
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Leader is included in session detail response ─────────

test('session detail includes assigned leaders', function () {
    ['token' => $token, 'session' => $session, 'leader' => $leader]
        = makeSessionWithLeader();

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonCount(1, 'leaders')
        ->assertJsonPath('leaders.0.first_name', $leader->first_name)
        ->assertJsonPath('leaders.0.last_name', $leader->last_name);
});

test('session detail includes leader bio, city, and state', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader([
            'bio' => 'Award-winning landscape photographer.',
            'city' => 'Portland',
            'state_or_region' => 'OR',
        ]);

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.bio', 'Award-winning landscape photographer.')
        ->assertJsonPath('leaders.0.city', 'Portland')
        ->assertJsonPath('leaders.0.state_or_region', 'OR');
});

test('session detail includes leader profile_image_url', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader([
            'profile_image_url' => 'https://cdn.wayfield.app/leaders/abc123.jpg',
        ]);

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.profile_image_url', 'https://cdn.wayfield.app/leaders/abc123.jpg');
});

test('session detail includes leader role_label from pivot when set', function () {
    ['token' => $token, 'session' => $session, 'leader' => $leader]
        = makeSessionWithLeader();

    SessionLeader::where('session_id', $session->id)
        ->where('leader_id', $leader->id)
        ->update(['role_label' => 'Lead Instructor']);

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.role_label', 'Lead Instructor');
});

// ─── Phone number visibility — organizer ──────────────────

test('owner can see leader phone number in session detail', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader(['phone_number' => '555-867-5309'], role: 'owner');

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.phone_number', '555-867-5309')
        ->assertJsonPath('leaders.0.phone_visible', true);
});

test('admin can see leader phone number in session detail', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader(['phone_number' => '555-867-5309'], role: 'admin');

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.phone_number', '555-867-5309');
});

test('staff can see leader phone number in session detail', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader(['phone_number' => '555-867-5309'], role: 'staff');

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.phone_number', '555-867-5309');
});

// ─── Phone number visibility — denied ─────────────────────

test('billing_admin cannot see leader phone number', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader(['phone_number' => '555-867-5309'], role: 'billing_admin');

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.phone_number', null)
        ->assertJsonPath('leaders.0.phone_visible', false);
});

test('participant cannot see leader phone number', function () {
    $participant = User::factory()->create(['email_verified_at' => now()]);
    $token = $participant->createToken('web')->plainTextToken;

    ['session' => $session] = makeSessionWithLeader(['phone_number' => '555-867-5309']);

    Registration::factory()->create([
        'workshop_id' => $session->workshop_id,
        'user_id' => $participant->id,
        'registration_status' => 'registered',
    ]);

    // Participants are not org members; session policy requires org membership to view
    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(403);
});

// ─── Only accepted leaders are shown ──────────────────────

test('pending leader assignment is not included in session leaders', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader();

    $pendingLeader = Leader::factory()->create([
        'first_name' => 'Pending',
        'last_name' => 'Leader',
    ]);
    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $pendingLeader->id,
        'assignment_status' => 'pending',
    ]);

    $response = $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200);

    expect($response->json('leaders'))->toHaveCount(1);
    $firstNames = array_column($response->json('leaders'), 'first_name');
    expect($firstNames)->not->toContain('Pending');
});

// ─── Multiple leaders ─────────────────────────────────────

test('session with multiple accepted leaders returns all of them', function () {
    ['token' => $token, 'session' => $session, 'org' => $org]
        = makeSessionWithLeader();

    $leader2 = Leader::factory()->create([
        'first_name' => 'Second',
        'last_name' => 'Leader',
    ]);
    LeaderInvitation::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader2->id,
        'status' => 'accepted',
    ]);
    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader2->id,
        'assignment_status' => 'accepted',
    ]);

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonCount(2, 'leaders');
});

// ─── Session with no leader ────────────────────────────────

test('session with no leader assignment returns empty leaders array', function () {
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $org = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);
    $token = $owner->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonCount(0, 'leaders');
});

// ─── Cross-tenant: cannot access another org's session ────

test('user from a different org cannot view session leaders', function () {
    ['session' => $session] = makeSessionWithLeader();

    $outsider = User::factory()->create(['email_verified_at' => now()]);
    $token = $outsider->createToken('web')->plainTextToken;

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(403);
});

// ─── Leader with no profile image ────────────────────────

test('leader with no profile image returns null for profile_image_url', function () {
    ['token' => $token, 'session' => $session]
        = makeSessionWithLeader(['profile_image_url' => null]);

    $this->withToken($token)
        ->getJson("/api/v1/sessions/{$session->id}")
        ->assertStatus(200)
        ->assertJsonPath('leaders.0.profile_image_url', null);
});

// ─── Helper ───────────────────────────────────────────────

/**
 * Creates an org, a user with the given role, a workshop, a session,
 * and a leader assigned to that session with assignment_status = 'accepted'.
 *
 * @param  array<string, mixed>  $leaderAttrs  Override Leader factory attributes
 * @param  string  $role  The org role for the test user
 * @return array<string, mixed>
 */
function makeSessionWithLeader(array $leaderAttrs = [], string $role = 'owner'): array
{
    $user = User::factory()->create(['email_verified_at' => now()]);
    $org = Organization::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => $role,
        'is_active' => true,
    ]);

    $workshop = Workshop::factory()->create([
        'organization_id' => $org->id,
        'timezone' => 'America/Chicago',
    ]);
    $session = Session::factory()->create(['workshop_id' => $workshop->id]);

    $leaderUser = User::factory()->create();
    $leader = Leader::factory()->create(array_merge([
        'user_id' => $leaderUser->id,
        'first_name' => 'Jane',
        'last_name' => 'Appleseed',
        'bio' => 'Landscape photographer and educator.',
        'city' => 'Ashford',
        'state_or_region' => 'WA',
        'phone_number' => '555-100-0000',
        'profile_image_url' => null,
    ], $leaderAttrs));

    LeaderInvitation::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
        'status' => 'accepted',
    ]);

    SessionLeader::create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    $token = $user->createToken('web')->plainTextToken;

    return compact('user', 'org', 'workshop', 'session', 'leader', 'token');
}
