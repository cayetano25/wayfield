<?php

use App\Models\Organization;
use App\Models\Workshop;
use App\Domain\Seo\Models\WorkshopCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('it_returns_sitemap_workshops_payload_with_required_fields', function () {
    $org = Organization::factory()->create();
    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'sitemap-test-workshop',
        'start_date' => now()->addDays(30)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/public/sitemap/workshops')
        ->assertStatus(200);

    $items = $response->json('data');
    expect($items)->not->toBeEmpty();

    $item = collect($items)->firstWhere('public_slug', 'sitemap-test-workshop');
    expect($item)->not->toBeNull();

    expect($item)->toHaveKey('public_slug');
    expect($item)->toHaveKey('updated_at');
    expect($item)->toHaveKey('start_date');
    expect($item)->toHaveKey('priority');
});

test('it_assigns_high_priority_to_upcoming_workshops', function () {
    $org = Organization::factory()->create();

    // Within 90 days → priority 0.9
    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'upcoming-soon-workshop',
        'start_date' => now()->addDays(30)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/public/sitemap/workshops')
        ->assertStatus(200);

    $item = collect($response->json('data'))->firstWhere('public_slug', 'upcoming-soon-workshop');
    expect($item['priority'])->toBe(0.9);
});

test('it_assigns_medium_priority_to_distant_upcoming_workshops', function () {
    $org = Organization::factory()->create();

    // More than 90 days out → priority 0.7
    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'far-future-workshop',
        'start_date' => now()->addDays(120)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/public/sitemap/workshops')
        ->assertStatus(200);

    $item = collect($response->json('data'))->firstWhere('public_slug', 'far-future-workshop');
    expect($item['priority'])->toBe(0.7);
});

test('it_assigns_low_priority_to_past_workshops', function () {
    $org = Organization::factory()->create();

    // In the past → priority 0.4
    Workshop::factory()->forOrganization($org->id)->published()->create([
        'public_slug' => 'past-workshop',
        'start_date' => now()->subDays(30)->toDateString(),
        'end_date' => now()->subDays(27)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/public/sitemap/workshops')
        ->assertStatus(200);

    $item = collect($response->json('data'))->firstWhere('public_slug', 'past-workshop');
    expect($item['priority'])->toBe(0.4);
});

test('it_excludes_draft_workshops_from_sitemap', function () {
    $org = Organization::factory()->create();

    Workshop::factory()->forOrganization($org->id)->draft()->create([
        'public_slug' => 'draft-sitemap-workshop',
        'start_date' => now()->addDays(30)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/public/sitemap/workshops')
        ->assertStatus(200);

    $slugs = collect($response->json('data'))->pluck('public_slug')->all();
    expect($slugs)->not->toContain('draft-sitemap-workshop');
});

test('it_excludes_workshops_with_public_page_disabled_from_sitemap', function () {
    $org = Organization::factory()->create();

    Workshop::factory()->forOrganization($org->id)->create([
        'status' => 'published',
        'public_page_enabled' => false,
        'public_slug' => 'disabled-page-workshop',
        'start_date' => now()->addDays(30)->toDateString(),
    ]);

    $response = $this->getJson('/api/v1/public/sitemap/workshops')
        ->assertStatus(200);

    $slugs = collect($response->json('data'))->pluck('public_slug')->all();
    expect($slugs)->not->toContain('disabled-page-workshop');
});

test('it_returns_only_categories_with_at_least_one_public_workshop', function () {
    $org = Organization::factory()->create();

    $activeCategory = WorkshopCategory::firstOrCreate(
        ['slug' => 'sitemap-active-category'],
        ['name' => 'Sitemap Active Category', 'is_active' => true, 'sort_order' => 1]
    );

    $emptyCategory = WorkshopCategory::firstOrCreate(
        ['slug' => 'sitemap-empty-category'],
        ['name' => 'Sitemap Empty Category', 'is_active' => true, 'sort_order' => 2]
    );

    $workshop = Workshop::factory()->forOrganization($org->id)->published()->create();
    $workshop->categories()->attach($activeCategory->id);
    // $emptyCategory has no workshops attached

    $response = $this->getJson('/api/v1/public/sitemap/categories')
        ->assertStatus(200);

    $slugs = collect($response->json('data'))->pluck('slug')->all();
    expect($slugs)->toContain('sitemap-active-category');
    expect($slugs)->not->toContain('sitemap-empty-category');
});
