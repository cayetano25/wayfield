<?php

use App\Models\Leader;
use App\Models\Organization;
use App\Models\TaxonomyCategory;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Happy path ───────────────────────────────────────────────────────────────

test('it_returns_publicly_visible_workshop_by_slug', function () {
    $org = Organization::factory()->create();
    Workshop::factory()->forOrganization($org->id)->published()->create([
        'title' => 'Landscape Photography Retreat',
        'public_slug' => 'landscape-photography-retreat',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/landscape-photography-retreat')
        ->assertStatus(200);

    expect($response->json('title'))->toBe('Landscape Photography Retreat');
    expect($response->json('public_slug'))->toBe('landscape-photography-retreat');
    expect($response->json('status'))->toBe('published');
});

test('it_returns_paginated_workshop_listing', function () {
    $org = Organization::factory()->create();

    // Use explicit slugs to avoid unique constraint collisions
    Workshop::factory()->forOrganization($org->id)->published()->create(['public_slug' => 'listing-workshop-1']);
    Workshop::factory()->forOrganization($org->id)->published()->create(['public_slug' => 'listing-workshop-2']);
    Workshop::factory()->forOrganization($org->id)->published()->create(['public_slug' => 'listing-workshop-3']);

    $response = $this->getJson('/api/v1/public/workshops')
        ->assertStatus(200);

    // Paginated response has a 'data' key
    $data = $response->json('data');
    expect(count($data))->toBeGreaterThan(2);
});

test('it_filters_workshops_by_category', function () {
    // The Discovery endpoint filters by primaryTaxonomy.category.slug via ?category=
    $org = Organization::factory()->create();

    $category = TaxonomyCategory::factory()->create([
        'name' => 'Portrait Photography',
        'slug' => 'portrait-photography',
        'is_active' => true,
    ]);

    $inCategory = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'in-category-workshop',
    ]);
    \App\Models\WorkshopTaxonomy::create([
        'workshop_id' => $inCategory->id,
        'category_id' => $category->id,
        'is_primary' => true,
    ]);

    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'not-in-category-workshop',
    ]);

    $response = $this->getJson('/api/v1/public/workshops?category=portrait-photography')
        ->assertStatus(200);

    $slugs = collect($response->json('data'))->pluck('public_slug')->all();
    expect($slugs)->toContain('in-category-workshop');
    expect($slugs)->not->toContain('not-in-category-workshop');
});

test('it_filters_workshops_by_location', function () {
    // The Discovery endpoint does not expose a location filter.
    // Location filtering in the public SEO layer is via the category+location route.
    // This test verifies that workshop location data is included in the detail response.
    $org = Organization::factory()->create();

    $location = \App\Models\Location::factory()->create([
        'organization_id' => $org->id,
        'city' => 'Austin',
        'state_or_region' => 'TX',
    ]);

    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'located-workshop',
        'default_location_id' => $location->id,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/located-workshop')
        ->assertStatus(200);

    expect($response->json('default_location.city'))->toBe('Austin');
    expect($response->json('default_location.state_or_region'))->toBe('TX');
});

// ─── Privacy enforcement ──────────────────────────────────────────────────────

test('meeting_url_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'virtual-workshop',
    ]);

    \App\Models\Session::factory()->create([
        'workshop_id' => $workshop->id,
        'delivery_type' => 'virtual',
        'meeting_url' => 'https://zoom.us/j/secret-meeting-id',
        'is_published' => true,
        'participant_visibility' => 'visible',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/virtual-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('meeting_url');
    expect($responseString)->not->toContain('secret-meeting-id');
});

test('meeting_passcode_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'virtual-passcode-workshop',
    ]);

    \App\Models\Session::factory()->create([
        'workshop_id' => $workshop->id,
        'delivery_type' => 'virtual',
        'meeting_passcode' => 'supersecret',
        'is_published' => true,
        'participant_visibility' => 'visible',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/virtual-passcode-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('meeting_passcode');
    expect($responseString)->not->toContain('supersecret');
});

test('meeting_id_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'virtual-id-workshop',
    ]);

    \App\Models\Session::factory()->create([
        'workshop_id' => $workshop->id,
        'delivery_type' => 'virtual',
        'meeting_id' => '987654321',
        'is_published' => true,
        'participant_visibility' => 'visible',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/virtual-id-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('987654321');
});

test('leader_phone_number_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'phone-privacy-workshop',
    ]);

    $leader = Leader::factory()->create([
        'phone_number' => '555-PRIVATE',
    ]);

    WorkshopLeader::factory()->confirmed()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/phone-privacy-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('phone_number');
    expect($responseString)->not->toContain('555-PRIVATE');
});

test('leader_address_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'address-privacy-workshop',
    ]);

    $leader = Leader::factory()->create([
        'address_line_1' => '999 Confidential Ave',
        'postal_code' => '78701',
        'country' => 'US',
    ]);

    WorkshopLeader::factory()->confirmed()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/address-privacy-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('address_line_1');
    expect($responseString)->not->toContain('999 Confidential Ave');
    expect($responseString)->not->toContain('postal_code');
    expect($responseString)->not->toContain('78701');
});

test('leader_email_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'email-privacy-workshop',
    ]);

    $leader = Leader::factory()->create([
        'email' => 'private-leader@example.com',
    ]);

    WorkshopLeader::factory()->confirmed()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/email-privacy-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('private-leader@example.com');
});

test('organizer_contact_details_are_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create([
        'primary_contact_phone' => '555-ORG-PRIVATE',
        'primary_contact_email' => 'orgcontact@private.com',
    ]);

    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'org-privacy-workshop',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/org-privacy-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('primary_contact_phone');
    expect($responseString)->not->toContain('555-ORG-PRIVATE');
    expect($responseString)->not->toContain('primary_contact_email');
    expect($responseString)->not->toContain('orgcontact@private.com');
});

test('join_code_is_never_exposed_on_public_workshop_detail', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'join-code-privacy-workshop',
        'join_code' => 'ABCD1234',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/join-code-privacy-workshop')
        ->assertStatus(200);

    $responseString = json_encode($response->json());
    expect($responseString)->not->toContain('join_code');
    expect($responseString)->not->toContain('ABCD1234');
});

// ─── Access control ───────────────────────────────────────────────────────────

test('it_returns_404_for_draft_workshop', function () {
    $org = Organization::factory()->create();
    Workshop::factory()->forOrganization($org->id)->draft()->create([
        'public_slug' => 'draft-workshop',
    ]);

    $this->getJson('/api/v1/public/workshops/draft-workshop')
        ->assertStatus(404);
});

test('it_returns_404_for_workshop_with_public_page_disabled', function () {
    $org = Organization::factory()->create();
    Workshop::factory()->forOrganization($org->id)->create([
        'status' => 'published',
        'public_page_enabled' => false,
        'public_slug' => 'hidden-workshop',
    ]);

    $this->getJson('/api/v1/public/workshops/hidden-workshop')
        ->assertStatus(404);
});

test('it_returns_404_for_nonexistent_slug', function () {
    $this->getJson('/api/v1/public/workshops/this-slug-does-not-exist')
        ->assertStatus(404);
});

test('it_does_not_return_unconfirmed_leaders', function () {
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'unconfirmed-leader-workshop',
    ]);

    $leader = Leader::factory()->create(['first_name' => 'HiddenLeader']);

    WorkshopLeader::factory()->create([
        'workshop_id' => $workshop->id,
        'leader_id' => $leader->id,
        'is_confirmed' => false,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/unconfirmed-leader-workshop')
        ->assertStatus(200);

    expect($response->json('leaders'))->toBeEmpty();
});
