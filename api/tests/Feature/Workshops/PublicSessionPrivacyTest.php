<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function privacyWorkshopWithSession(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_page_enabled' => true,
        'public_slug'         => 'session-privacy-' . uniqid(),
    ]);

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'title'                 => 'Morning Light Shoot',
        'description'           => str_repeat('A', 200),
        'is_published'          => true,
        'publication_status'    => 'published',
        'participant_visibility' => 'visible',
        'meeting_url'           => 'https://zoom.us/j/secret-link',
        'meeting_id'            => 'SECRET-ID',
        'meeting_passcode'      => 'SECRET-PW',
    ]);

    return [$org, $workshop, $session];
}

// ─── Description preview ──────────────────────────────────────────────────────

test('public session resource returns description_preview not full description', function () {
    [, $workshop, $session] = privacyWorkshopWithSession();

    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $sessions = $response->json('sessions');
    expect($sessions)->not->toBeNull();
    expect($sessions[0])->toHaveKey('description_preview');
    expect($sessions[0])->not->toHaveKey('description');
});

test('description_preview is max 120 characters', function () {
    [, $workshop] = privacyWorkshopWithSession();

    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $sessions = $response->json('sessions');
    expect($sessions)->not->toBeNull();
    expect(mb_strlen($sessions[0]['description_preview']))->toBeLessThanOrEqual(123); // 120 + '...'
});

// ─── Location privacy ─────────────────────────────────────────────────────────

test('public session resource does not include location_id', function () {
    [, $workshop] = privacyWorkshopWithSession();

    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $sessions = $response->json('sessions');
    expect($sessions)->not->toBeNull();
    expect($sessions[0])->not->toHaveKey('location_id');
    expect($sessions[0])->not->toHaveKey('location_city');
    expect($sessions[0])->not->toHaveKey('location_state');
});

// ─── Meeting URL never exposed ────────────────────────────────────────────────

test('public session resource does not include meeting_url', function () {
    [, $workshop] = privacyWorkshopWithSession();

    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $body = json_encode($response->json());
    expect($body)->not->toContain('meeting_url');
    expect($body)->not->toContain('secret-link');
    expect($body)->not->toContain('SECRET-ID');
    expect($body)->not->toContain('SECRET-PW');

    $sessions = $response->json('sessions');
    expect($sessions[0])->not->toHaveKey('meeting_url');
});

// ─── Required public fields are present ──────────────────────────────────────

test('public session resource contains required safe fields', function () {
    [, $workshop] = privacyWorkshopWithSession();

    $response = $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertStatus(200);

    $sessions = $response->json('sessions');
    expect($sessions)->not->toBeNull();
    $s = $sessions[0];
    expect($s)->toHaveKey('id');
    expect($s)->toHaveKey('title');
    expect($s)->toHaveKey('start_at');
    expect($s)->toHaveKey('end_at');
    expect($s)->toHaveKey('delivery_type');
    expect($s)->toHaveKey('is_addon');
    expect($s)->toHaveKey('description_preview');
});
