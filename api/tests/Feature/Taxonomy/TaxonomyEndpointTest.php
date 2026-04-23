<?php

use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

// ─── GET /api/v1/taxonomy ────────────────────────────────────────────────────

test('GET /taxonomy returns full tree with categories, subcategories, specializations, and tag groups', function () {
    $category = TaxonomyCategory::factory()->create(['name' => 'Photography', 'slug' => 'photography', 'is_active' => true, 'sort_order' => 0]);
    $sub = TaxonomySubcategory::factory()->create(['category_id' => $category->id, 'name' => 'Portrait', 'slug' => 'portrait', 'is_active' => true, 'sort_order' => 0]);
    TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'name' => 'Studio Portrait', 'slug' => 'studio-portrait', 'is_active' => true, 'sort_order' => 0]);

    $group = TaxonomyTagGroup::factory()->create(['key' => 'skill_level', 'label' => 'Skill Level', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'beginner', 'label' => 'Beginner', 'is_active' => true, 'sort_order' => 0]);

    $response = $this->getJson('/api/v1/taxonomy');

    $response->assertOk()
        ->assertJsonStructure([
            'categories' => [
                '*' => ['id', 'name', 'slug', 'sort_order', 'subcategories'],
            ],
            'tag_groups' => [
                '*' => ['id', 'key', 'label', 'allows_multiple', 'tags'],
            ],
        ])
        ->assertJsonPath('categories.0.name', 'Photography')
        ->assertJsonPath('categories.0.subcategories.0.name', 'Portrait')
        ->assertJsonPath('categories.0.subcategories.0.specializations.0.name', 'Studio Portrait')
        ->assertJsonPath('tag_groups.0.key', 'skill_level')
        ->assertJsonPath('tag_groups.0.tags.0.value', 'beginner');
});

test('GET /taxonomy excludes inactive categories', function () {
    TaxonomyCategory::factory()->create(['name' => 'Active', 'slug' => 'active', 'is_active' => true, 'sort_order' => 0]);
    TaxonomyCategory::factory()->create(['name' => 'Inactive', 'slug' => 'inactive', 'is_active' => false, 'sort_order' => 1]);

    $response = $this->getJson('/api/v1/taxonomy');

    $response->assertOk();
    $names = collect($response->json('categories'))->pluck('name');
    expect($names)->toContain('Active')->not->toContain('Inactive');
});

test('GET /taxonomy response is cached and served from cache on second call', function () {
    Cache::flush();
    TaxonomyCategory::factory()->create(['name' => 'Arts', 'slug' => 'arts', 'is_active' => true, 'sort_order' => 0]);

    $this->getJson('/api/v1/taxonomy')->assertOk();
    expect(Cache::has('taxonomy.full_tree'))->toBeTrue();

    // Second call should still work
    $this->getJson('/api/v1/taxonomy')->assertOk();
});

test('taxonomy cache is busted when a category is updated', function () {
    Cache::flush();
    $cat = TaxonomyCategory::factory()->create(['name' => 'Arts', 'slug' => 'arts', 'is_active' => true, 'sort_order' => 0]);

    $this->getJson('/api/v1/taxonomy')->assertOk();
    expect(Cache::has('taxonomy.full_tree'))->toBeTrue();

    $cat->update(['name' => 'Arts & Visuals']);
    expect(Cache::has('taxonomy.full_tree'))->toBeFalse();
});

// ─── GET /api/v1/taxonomy/categories ─────────────────────────────────────────

test('GET /taxonomy/categories returns flat list of active categories', function () {
    TaxonomyCategory::factory()->create(['name' => 'Arts', 'slug' => 'arts', 'is_active' => true, 'sort_order' => 0]);
    TaxonomyCategory::factory()->create(['name' => 'Hidden', 'slug' => 'hidden', 'is_active' => false, 'sort_order' => 1]);

    $response = $this->getJson('/api/v1/taxonomy/categories');

    $response->assertOk()
        ->assertJsonStructure(['categories' => [['id', 'name', 'slug', 'sort_order']]]);

    $names = collect($response->json('categories'))->pluck('name');
    expect($names)->toContain('Arts')->not->toContain('Hidden');
});

// ─── GET /api/v1/taxonomy/categories/{slug}/subcategories ────────────────────

test('GET /taxonomy/categories/{slug}/subcategories returns subcategories with specializations', function () {
    $cat = TaxonomyCategory::factory()->create(['slug' => 'photography', 'is_active' => true, 'sort_order' => 0]);
    $sub = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'name' => 'Portrait', 'slug' => 'portrait', 'is_active' => true, 'sort_order' => 0]);
    TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'name' => 'Studio', 'slug' => 'studio', 'is_active' => true, 'sort_order' => 0]);

    $response = $this->getJson('/api/v1/taxonomy/categories/photography/subcategories');

    $response->assertOk()
        ->assertJsonPath('category.slug', 'photography')
        ->assertJsonPath('subcategories.0.name', 'Portrait')
        ->assertJsonPath('subcategories.0.specializations.0.name', 'Studio');
});

test('GET /taxonomy/categories/{slug}/subcategories returns 404 for unknown slug', function () {
    $this->getJson('/api/v1/taxonomy/categories/does-not-exist/subcategories')
        ->assertNotFound();
});

test('GET /taxonomy/categories/{slug}/subcategories returns 404 for inactive category', function () {
    TaxonomyCategory::factory()->create(['slug' => 'inactive-cat', 'is_active' => false, 'sort_order' => 0]);

    $this->getJson('/api/v1/taxonomy/categories/inactive-cat/subcategories')
        ->assertNotFound();
});

// ─── Seeded data coverage ─────────────────────────────────────────────────────

test('taxonomy tree contains all 14 seeded categories', function () {
    $this->artisan('db:seed', ['--class' => 'TaxonomySeeder']);

    $response = $this->getJson('/api/v1/taxonomy');

    $response->assertOk();
    expect(count($response->json('categories')))->toBe(14);
});

test('seeded category has nested subcategories and specializations in tree', function () {
    $this->artisan('db:seed', ['--class' => 'TaxonomySeeder']);

    $response = $this->getJson('/api/v1/taxonomy');

    $response->assertOk();

    $categories = collect($response->json('categories'));
    $hasSubcategories = $categories->contains(fn ($cat) => count($cat['subcategories']) > 0);
    expect($hasSubcategories)->toBeTrue();

    $hasSpecializations = $categories->contains(function ($cat) {
        return collect($cat['subcategories'])->contains(fn ($sub) => count($sub['specializations']) > 0);
    });
    expect($hasSpecializations)->toBeTrue();
});

test('taxonomy tree contains seeded tag groups with nested tags', function () {
    $this->artisan('db:seed', ['--class' => 'TaxonomySeeder']);

    $response = $this->getJson('/api/v1/taxonomy');

    $response->assertOk();

    $tagGroups = collect($response->json('tag_groups'));
    expect($tagGroups->count())->toBeGreaterThan(0);

    $hasTagsInGroup = $tagGroups->contains(fn ($group) => count($group['tags']) > 0);
    expect($hasTagsInGroup)->toBeTrue();
});

test('second taxonomy request is served from cache with no additional DB queries', function () {
    Cache::flush();
    TaxonomyCategory::factory()->create(['slug' => 'query-test', 'is_active' => true, 'sort_order' => 0]);

    // First request populates cache
    $this->getJson('/api/v1/taxonomy')->assertOk();
    expect(Cache::has('taxonomy.full_tree'))->toBeTrue();

    // Track queries for the second request — should be zero since the payload is cached
    \Illuminate\Support\Facades\DB::enableQueryLog();
    $this->getJson('/api/v1/taxonomy')->assertOk();
    $queries = \Illuminate\Support\Facades\DB::getQueryLog();
    \Illuminate\Support\Facades\DB::disableQueryLog();

    expect(count($queries))->toBe(0);
});
