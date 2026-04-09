<?php

use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Explicit private-field exclusion regression test ────────────────────────
//
// This test is the canonical guard for PublicLeaderResource privacy.
// It must:
//   (a) assert every private field is individually absent from the JSON
//   (b) assert the response contains EXACTLY the allowed keys and nothing else
//
// If a new field is added to PublicLeaderResource without review, (b) will
// fail and block the change until it is explicitly approved here.

test('public leader resource never exposes private fields', function () {
    $user = User::factory()->create();

    // Populate every private field with a non-null, non-empty value so the
    // test cannot pass by accident because the field was null and omitted.
    $leader = Leader::factory()->withUser($user->id)->create([
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'display_name' => 'Jane Doe Photography',
        'bio' => 'Landscape and portrait photographer.',
        'profile_image_url' => 'https://cdn.example.com/jane.jpg',
        'website_url' => 'https://janedoe.com',
        'city' => 'Austin',
        'state_or_region' => 'TX',
        // Private — must never appear in public response
        'email' => 'jane@private.com',
        'phone_number' => '555-0001',
        'address_line_1' => '123 Private St',
        'address_line_2' => 'Apt 4B',
        'postal_code' => '78701',
        'country' => 'US',
    ]);

    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug' => 'privacy-regression-workshop',
    ]);

    WorkshopLeader::factory()->confirmed()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);

    $leaderData = $this->getJson('/api/v1/public/workshops/privacy-regression-workshop')
        ->assertStatus(200)
        ->json('leaders.0');

    // ── (a) Each private field must be absent ─────────────────────────────────
    // This list is the complete set of fields that must NEVER appear publicly.
    // Adding a field here without removing it from PublicLeaderResource is a bug.
    $privateFields = [
        'email',
        'phone_number',
        'address_line_1',
        'address_line_2',
        'postal_code',
        'country',
        'user_id',
    ];

    foreach ($privateFields as $field) {
        expect($leaderData)
            ->not->toHaveKey($field, "Private field '{$field}' must not appear in public leader response.");
    }

    // ── (b) Response contains EXACTLY the allowed keys — no more, no less ────
    // If a new field is added to PublicLeaderResource, this assertion fails
    // until it is explicitly approved and added to $allowedKeys here.
    $allowedKeys = [
        'id',
        'first_name',
        'last_name',
        'display_name',
        'profile_image_url',
        'bio',
        'website_url',
        'city',
        'state_or_region',
    ];

    expect(array_keys($leaderData))->toEqual($allowedKeys);

    // ── Spot-check that allowed fields carry the correct values ───────────────
    expect($leaderData['first_name'])->toBe('Jane');
    expect($leaderData['last_name'])->toBe('Doe');
    expect($leaderData['display_name'])->toBe('Jane Doe Photography');
    expect($leaderData['bio'])->toBe('Landscape and portrait photographer.');
    expect($leaderData['website_url'])->toBe('https://janedoe.com');
    expect($leaderData['city'])->toBe('Austin');
    expect($leaderData['state_or_region'])->toBe('TX');
});

// ─── Public workshop endpoint — confirmed/unconfirmed gate ────────────────────

test('public workshop endpoint shows confirmed leaders with only safe public fields', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug' => 'test-workshop',
    ]);

    $leader = Leader::factory()->create([
        'first_name' => 'Jane',
        'last_name' => 'Doe',
        'email' => 'jane@private.com',
        'phone_number' => '555-1234',
        'address_line_1' => '123 Private St',
        'address_line_2' => 'Suite 5',
        'postal_code' => '78701',
        'country' => 'US',
        'city' => 'Austin',
        'state_or_region' => 'TX',
        'bio' => 'Landscape photographer.',
        'website_url' => 'https://janedoe.com',
    ]);

    WorkshopLeader::factory()->confirmed()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);

    $leaderData = $this->getJson('/api/v1/public/workshops/test-workshop')
        ->assertStatus(200)
        ->json('leaders.0');

    // Safe fields present
    expect($leaderData['first_name'])->toBe('Jane');
    expect($leaderData['last_name'])->toBe('Doe');
    expect($leaderData['bio'])->toBe('Landscape photographer.');
    expect($leaderData['website_url'])->toBe('https://janedoe.com');
    expect($leaderData['city'])->toBe('Austin');
    expect($leaderData['state_or_region'])->toBe('TX');

    // Private fields absent (all seven, including address_line_2)
    expect($leaderData)->not->toHaveKey('email');
    expect($leaderData)->not->toHaveKey('phone_number');
    expect($leaderData)->not->toHaveKey('address_line_1');
    expect($leaderData)->not->toHaveKey('address_line_2');
    expect($leaderData)->not->toHaveKey('postal_code');
    expect($leaderData)->not->toHaveKey('country');
    expect($leaderData)->not->toHaveKey('user_id');
});

// ─── Acceptance criterion 9: unaccepted leader never appears publicly ────────
//
// Two distinct scenarios must both be blocked:
//   (a) invitation is still pending — no workshop_leaders row has been created yet
//   (b) workshop_leaders row exists but is_confirmed = false (organizer pre-created the row)
//
// The existing test below covers (b). The test here covers (a).

test('leader with a pending invitation is not shown on public workshop page', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug' => 'pending-inv-workshop',
    ]);

    // A leader record exists (organizer created a placeholder) but the invitation
    // is still pending — the leader has NOT accepted. No workshop_leaders row exists.
    $admin = User::factory()->create();
    $leader = Leader::factory()->create(['first_name' => 'Unaccepted']);

    // Invitation is pending — no acceptance, no workshop_leaders row
    LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->forWorkshop($workshop->id)
        ->create([
            'leader_id' => null, // null until accepted
            'status' => 'pending',
        ]);

    $response = $this->getJson('/api/v1/public/workshops/pending-inv-workshop')
        ->assertStatus(200);

    // Leaders array must be empty — pending invitation must not surface publicly
    expect($response->json('leaders'))->toBeEmpty();
});

test('public workshop endpoint does not show unconfirmed leaders', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug' => 'test-workshop-2',
    ]);

    $leader = Leader::factory()->create(['first_name' => 'Hidden']);

    // Not confirmed (is_confirmed = false)
    WorkshopLeader::factory()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
        'is_confirmed' => false,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/test-workshop-2')
        ->assertStatus(200);

    expect($response->json('leaders'))->toBeEmpty();
});

test('organizer leader resource includes private fields', function () {
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $admin->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $leader = Leader::factory()->create([
        'email' => 'private@example.com',
        'phone_number' => '555-9999',
        'address_line_1' => '1 Confidential Ave',
    ]);

    OrganizationLeader::factory()->create([
        'organization_id' => $org->id,
        'leader_id' => $leader->id,
    ]);

    $response = $this->actingAs($admin, 'sanctum')
        ->getJson("/api/v1/organizations/{$org->id}/leaders")
        ->assertStatus(200);

    $leaderData = $response->json('0');

    // Organizer should see private fields
    expect($leaderData['email'])->toBe('private@example.com');
    expect($leaderData['phone_number'])->toBe('555-9999');
    expect($leaderData['address_line_1'])->toBe('1 Confidential Ave');
});

test('leader self-profile resource includes private address fields', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->withUser($user->id)->create([
        'address_line_1' => '1 Private Rd',
        'postal_code' => '78701',
        'country' => 'US',
        'phone_number' => '555-0000',
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/leader/profile')
        ->assertStatus(200);

    expect($response->json('address_line_1'))->toBe('1 Private Rd');
    expect($response->json('postal_code'))->toBe('78701');
    expect($response->json('country'))->toBe('US');
    expect($response->json('phone_number'))->toBe('555-0000');
});
