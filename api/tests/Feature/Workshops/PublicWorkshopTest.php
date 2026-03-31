<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLogistics;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('published workshop with public page enabled is accessible publicly', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'mountain-light-2026',
    ]);

    $this->getJson('/api/v1/public/workshops/mountain-light-2026')
        ->assertStatus(200)
        ->assertJsonPath('title', $workshop->title);
});

test('draft workshop is not accessible on public endpoint', function () {
    Workshop::factory()->draft()->create([
        'public_page_enabled' => false,
        'public_slug'         => 'hidden-workshop',
    ]);

    $this->getJson('/api/v1/public/workshops/hidden-workshop')
        ->assertStatus(404);
});

test('published workshop with public_page_enabled=false is not accessible publicly', function () {
    Workshop::factory()->published()->create([
        'public_page_enabled' => false,
        'public_slug'         => 'no-public-page',
    ]);

    $this->getJson('/api/v1/public/workshops/no-public-page')
        ->assertStatus(404);
});

test('archived workshop is not accessible on public endpoint', function () {
    Workshop::factory()->archived()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'archived-workshop',
    ]);

    $this->getJson('/api/v1/public/workshops/archived-workshop')
        ->assertStatus(404);
});

test('public workshop response does not expose join_code', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'no-join-code',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/no-join-code');

    $response->assertStatus(200);
    expect($response->json())->not->toHaveKey('join_code');
});

test('public workshop response does not expose organization_id', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'no-org-id',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/no-org-id');

    $response->assertStatus(200);
    expect($response->json())->not->toHaveKey('organization_id');
});

test('public workshop response includes logistics hotel and parking fields', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'with-logistics',
    ]);

    WorkshopLogistics::factory()->create([
        'workshop_id'     => $workshop->id,
        'hotel_name'      => 'Grand Vista Hotel',
        'parking_details' => 'Lot B behind the building',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/with-logistics');

    $response->assertStatus(200)
        ->assertJsonPath('logistics.hotel_name', 'Grand Vista Hotel')
        ->assertJsonPath('logistics.parking_details', 'Lot B behind the building');
});

test('public endpoint is accessible without authentication', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'open-access',
    ]);

    // No actingAs — unauthenticated request
    $this->getJson('/api/v1/public/workshops/open-access')
        ->assertStatus(200);
});

test('public workshop response never exposes forbidden fields', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'forbidden-fields-check',
    ]);

    $response = $this->getJson('/api/v1/public/workshops/forbidden-fields-check');
    $response->assertStatus(200);

    $body = $response->json();

    // Internal identity / state fields
    expect($body)->not->toHaveKey('join_code');
    expect($body)->not->toHaveKey('organization_id');
    expect($body)->not->toHaveKey('status');
    expect($body)->not->toHaveKey('public_page_enabled');
    expect($body)->not->toHaveKey('created_at');
    expect($body)->not->toHaveKey('updated_at');

    // Virtual session fields — must never appear even if accidentally embedded
    expect($body)->not->toHaveKey('meeting_url');
    expect($body)->not->toHaveKey('meeting_id');
    expect($body)->not->toHaveKey('meeting_passcode');
    expect($body)->not->toHaveKey('meeting_instructions');
    expect($body)->not->toHaveKey('meeting_platform');
});

test('public logistics response never exposes metadata fields', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'logistics-metadata-check',
    ]);

    WorkshopLogistics::factory()->create(['workshop_id' => $workshop->id]);

    $response = $this->getJson('/api/v1/public/workshops/logistics-metadata-check');
    $response->assertStatus(200);

    $logistics = $response->json('logistics');
    expect($logistics)->not->toBeNull();
    expect($logistics)->not->toHaveKey('id');
    expect($logistics)->not->toHaveKey('workshop_id');
    expect($logistics)->not->toHaveKey('created_at');
    expect($logistics)->not->toHaveKey('updated_at');
});

test('organizer logistics resource includes id for update operations', function () {
    [$user, $org] = makeOwner();

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    WorkshopLogistics::factory()->create(['workshop_id' => $workshop->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}");

    $response->assertStatus(200);
    expect($response->json('logistics'))->toHaveKey('id');
});

test('organizer workshop detail includes public_page fields', function () {
    [$user, $org] = makeOwner();

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'page-fields-check',
    ]);

    \App\Models\PublicPage::factory()->create([
        'workshop_id'   => $workshop->id,
        'hero_title'    => 'Join Us in the Wild',
        'hero_subtitle' => 'A week of landscape photography',
        'body_content'  => '<p>Full details here.</p>',
        'is_visible'    => true,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}");

    $response->assertStatus(200)
        ->assertJsonPath('public_page.hero_title', 'Join Us in the Wild')
        ->assertJsonPath('public_page.is_visible', true);
});

test('public page response exposes content fields but not is_visible or timestamps', function () {
    $workshop = Workshop::factory()->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'public-page-fields',
    ]);

    \App\Models\PublicPage::factory()->create([
        'workshop_id'   => $workshop->id,
        'hero_title'    => 'Capture the Light',
        'hero_subtitle' => 'Desert edition',
        'body_content'  => '<p>Details.</p>',
        'is_visible'    => true,
    ]);

    $response = $this->getJson('/api/v1/public/workshops/public-page-fields');
    $response->assertStatus(200);

    $page = $response->json('public_page');
    expect($page)->not->toBeNull();
    expect($page)->toHaveKey('hero_title');
    expect($page)->toHaveKey('hero_subtitle');
    expect($page)->toHaveKey('body_content');
    expect($page)->not->toHaveKey('is_visible');
    expect($page)->not->toHaveKey('id');
    expect($page)->not->toHaveKey('workshop_id');
    expect($page)->not->toHaveKey('created_at');
    expect($page)->not->toHaveKey('updated_at');
});

test('organizer workshop detail shows join_code but public endpoint does not', function () {
    $user = User::factory()->create();
    $org  = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    $workshop = Workshop::factory()->published()->forOrganization($org->id)->create([
        'public_page_enabled' => true,
        'public_slug'         => 'dual-check',
    ]);

    // Organizer sees join_code
    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}")
        ->assertStatus(200)
        ->assertJsonPath('join_code', $workshop->join_code);

    // Public does not see join_code
    $publicResponse = $this->getJson('/api/v1/public/workshops/dual-check');
    $publicResponse->assertStatus(200);
    expect($publicResponse->json())->not->toHaveKey('join_code');
});
