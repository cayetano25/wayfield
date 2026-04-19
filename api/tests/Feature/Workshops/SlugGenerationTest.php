<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugOwnerWithOrg(): array
{
    $org = Organization::factory()->create(['name' => 'Wayfield Photography']);
    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    return [$owner, $org];
}

function publishableWorkshop(Organization $org, array $overrides = []): Workshop
{
    return Workshop::factory()->eventBased()->forOrganization($org->id)->create(array_merge([
        'status' => 'draft',
        'title' => 'Mountain Light Workshop',
        'description' => 'A great workshop.',
        'timezone' => 'America/New_York',
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-03',
        'public_slug' => null,
    ], $overrides));
}

// ─── Slug generated on first publish ─────────────────────────────────────────

test('slug is null before a workshop is published', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org);

    expect($workshop->public_slug)->toBeNull();
});

test('slug is generated when a workshop is first published', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk()
        ->assertJsonPath('status', 'published');

    $workshop->refresh();
    expect($workshop->public_slug)->not->toBeNull();
    expect(strlen($workshop->public_slug))->toBeGreaterThan(0);
});

test('slug contains only lowercase letters, numbers, and hyphens', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org, ['title' => 'Mountain Light 2026!']);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk();

    $workshop->refresh();
    expect($workshop->public_slug)->toMatch('/^[a-z0-9-]+$/');
});

test('year is appended to slug when the base slug is already taken', function () {
    [$owner, $org] = slugOwnerWithOrg();

    // First workshop claims the base slug.
    $firstWorkshop = publishableWorkshop($org, [
        'title' => 'Desert Light',
        'start_date' => '2026-03-15',
    ]);
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$firstWorkshop->id}/publish")
        ->assertOk();
    $firstWorkshop->refresh();
    expect($firstWorkshop->public_slug)->toBe('desert-light');

    // Second workshop with the same title must fall back to the year-suffixed slug.
    $secondWorkshop = publishableWorkshop($org, [
        'title' => 'Desert Light',
        'start_date' => '2026-07-01',
    ]);
    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$secondWorkshop->id}/publish")
        ->assertOk();
    $secondWorkshop->refresh();
    expect($secondWorkshop->public_slug)->toContain('2026');
});

// ─── Slug is stable — not overwritten on re-publish or title change ───────────

test('slug is not regenerated when workshop title is changed after publish', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org, ['title' => 'Original Title']);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk();

    $workshop->refresh();
    $originalSlug = $workshop->public_slug;

    $this->actingAs($owner, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", ['title' => 'Completely New Title']);

    $workshop->refresh();
    expect($workshop->public_slug)->toBe($originalSlug);
});

test('re-publishing an already-published workshop does not change its slug', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk();

    $workshop->refresh();
    $firstSlug = $workshop->public_slug;

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk();

    $workshop->refresh();
    expect($workshop->public_slug)->toBe($firstSlug);
});

test('workshop with an existing slug set before publish keeps that slug', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org, ['public_slug' => 'my-custom-slug']);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk();

    $workshop->refresh();
    expect($workshop->public_slug)->toBe('my-custom-slug');
});

// ─── Slug uniqueness ──────────────────────────────────────────────────────────

test('two workshops with the same title in the same org in the same year receive different slugs', function () {
    [$owner, $org] = slugOwnerWithOrg();

    $workshopA = publishableWorkshop($org, [
        'title' => 'Coastal Light Workshop',
        'start_date' => '2026-06-01',
    ]);
    $workshopB = publishableWorkshop($org, [
        'title' => 'Coastal Light Workshop',
        'start_date' => '2026-07-01',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshopA->id}/publish")
        ->assertOk();

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshopB->id}/publish")
        ->assertOk();

    $workshopA->refresh();
    $workshopB->refresh();

    expect($workshopA->public_slug)->not->toBeNull();
    expect($workshopB->public_slug)->not->toBeNull();
    expect($workshopA->public_slug)->not->toBe($workshopB->public_slug);
});

test('two workshops with the same title in different orgs may have different slugs', function () {
    [$ownerA, $orgA] = slugOwnerWithOrg();
    [$ownerB, $orgB] = slugOwnerWithOrg();

    $workshopA = publishableWorkshop($orgA, ['title' => 'Shared Title Workshop', 'start_date' => '2026-08-01']);
    $workshopB = publishableWorkshop($orgB, ['title' => 'Shared Title Workshop', 'start_date' => '2026-08-01']);

    $this->actingAs($ownerA, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshopA->id}/publish")
        ->assertOk();

    $this->actingAs($ownerB, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshopB->id}/publish")
        ->assertOk();

    $workshopA->refresh();
    $workshopB->refresh();

    // Both slugs must be non-null and globally unique across the system.
    expect($workshopA->public_slug)->not->toBeNull();
    expect($workshopB->public_slug)->not->toBeNull();
    expect($workshopA->public_slug)->not->toBe($workshopB->public_slug);
});

test('published workshop is reachable at its generated slug on the public endpoint', function () {
    [$owner, $org] = slugOwnerWithOrg();
    $workshop = publishableWorkshop($org, [
        'public_page_enabled' => true,
        'title' => 'Forest Light Workshop',
        'start_date' => '2026-04-20',
    ]);

    $this->actingAs($owner, 'sanctum')
        ->postJson("/api/v1/workshops/{$workshop->id}/publish")
        ->assertOk();

    $workshop->refresh();

    $this->getJson("/api/v1/public/workshops/{$workshop->public_slug}")
        ->assertOk()
        ->assertJsonPath('title', 'Forest Light Workshop');
});
