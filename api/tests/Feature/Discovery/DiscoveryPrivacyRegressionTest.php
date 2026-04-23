<?php

use App\Models\Organization;
use App\Models\Session;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function privacyPublishedWorkshop(array $attrs = []): Workshop
{
    $org = Organization::factory()->create();

    return Workshop::factory()->create(array_merge([
        'organization_id'     => $org->id,
        'status'              => 'published',
        'public_page_enabled' => true,
        'public_slug'         => 'privacy-'.uniqid(),
        'start_date'          => '2026-10-01',
        'end_date'            => '2026-10-03',
    ], $attrs));
}

// ─── Status visibility guards ─────────────────────────────────────────────────

test('archived workshops are excluded from discovery results', function () {
    $archived = Workshop::factory()->create([
        'organization_id'     => Organization::factory()->create()->id,
        'status'              => 'archived',
        'public_page_enabled' => true,
        'public_slug'         => 'archived-'.uniqid(),
    ]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->not->toContain($archived->id);
});

test('draft workshops are excluded even when public_page_enabled is true', function () {
    $draft = Workshop::factory()->create([
        'organization_id'     => Organization::factory()->create()->id,
        'status'              => 'draft',
        'public_page_enabled' => true,
        'public_slug'         => 'draft-'.uniqid(),
    ]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->not->toContain($draft->id);
});

test('published workshops with public_page_enabled=false are excluded', function () {
    $hidden = Workshop::factory()->create([
        'organization_id'     => Organization::factory()->create()->id,
        'status'              => 'published',
        'public_page_enabled' => false,
        'public_slug'         => null,
    ]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->not->toContain($hidden->id);
});

// ─── Sensitive field exclusions ───────────────────────────────────────────────

test('join_code is never present anywhere in discovery response', function () {
    privacyPublishedWorkshop();

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $encoded = json_encode($response->json());
    expect($encoded)->not->toContain('join_code');
});

test('meeting_url is never present in discovery response even when sessions have virtual delivery', function () {
    $workshop = privacyPublishedWorkshop();
    Session::factory()->create([
        'workshop_id'   => $workshop->id,
        'is_published'  => true,
        'delivery_type' => 'virtual',
        'meeting_url'   => 'https://zoom.us/j/secret123',
        'start_at'      => '2026-10-01 09:00:00',
        'end_at'        => '2026-10-01 12:00:00',
    ]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $encoded = json_encode($response->json());
    expect($encoded)->not->toContain('meeting_url')
        ->not->toContain('secret123');
});

test('participant count data is not included in discovery response', function () {
    privacyPublishedWorkshop();

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $encoded = json_encode($response->json());
    expect($encoded)->not->toContain('participant_count')
        ->not->toContain('registration_count');
});

// ─── Authentication not required ─────────────────────────────────────────────

test('taxonomy tree endpoint is accessible without authentication', function () {
    $this->getJson('/api/v1/taxonomy')
        ->assertOk();
});

test('discovery endpoint is accessible without authentication', function () {
    $this->getJson('/api/v1/public/workshops')
        ->assertOk();
});
