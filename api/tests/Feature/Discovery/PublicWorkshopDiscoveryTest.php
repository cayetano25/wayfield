<?php

use App\Models\Organization;
use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use App\Models\Workshop;
use App\Models\WorkshopTaxonomy;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function discoveryWorkshop(array $attrs = []): Workshop
{
    $org = Organization::factory()->create(['name' => 'Discovery Org']);

    return Workshop::factory()->create(array_merge([
        'organization_id'     => $org->id,
        'status'              => 'published',
        'public_page_enabled' => true,
        'public_slug'         => 'discovery-'.uniqid(),
        'start_date'          => '2026-10-01',
        'end_date'            => '2026-10-03',
    ], $attrs));
}

// ─── Subcategory and specialization filters ────────────────────────────────────

test('filter by subcategory slug returns only workshops in that subcategory', function () {
    $cat    = TaxonomyCategory::factory()->create(['slug' => 'photography', 'is_active' => true, 'sort_order' => 0]);
    $subA   = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'slug' => 'portrait', 'is_active' => true, 'sort_order' => 0]);
    $subB   = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'slug' => 'landscape', 'is_active' => true, 'sort_order' => 1]);

    $portraitWorkshop   = discoveryWorkshop(['title' => 'Portrait Class']);
    WorkshopTaxonomy::create(['workshop_id' => $portraitWorkshop->id, 'category_id' => $cat->id, 'subcategory_id' => $subA->id, 'is_primary' => true]);

    $landscapeWorkshop  = discoveryWorkshop(['title' => 'Landscape Class']);
    WorkshopTaxonomy::create(['workshop_id' => $landscapeWorkshop->id, 'category_id' => $cat->id, 'subcategory_id' => $subB->id, 'is_primary' => true]);

    $response = $this->getJson('/api/v1/public/workshops?subcategory=portrait');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($portraitWorkshop->id)
        ->not->toContain($landscapeWorkshop->id);
});

test('filter by specialization slug returns only workshops with that specialization', function () {
    $cat   = TaxonomyCategory::factory()->create(['slug' => 'photo', 'is_active' => true, 'sort_order' => 0]);
    $sub   = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'slug' => 'portrait', 'is_active' => true, 'sort_order' => 0]);
    $specA = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'slug' => 'studio', 'is_active' => true, 'sort_order' => 0]);
    $specB = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'slug' => 'outdoor', 'is_active' => true, 'sort_order' => 1]);

    $studioWorkshop   = discoveryWorkshop(['title' => 'Studio Workshop']);
    WorkshopTaxonomy::create(['workshop_id' => $studioWorkshop->id, 'category_id' => $cat->id, 'subcategory_id' => $sub->id, 'specialization_id' => $specA->id, 'is_primary' => true]);

    $outdoorWorkshop  = discoveryWorkshop(['title' => 'Outdoor Workshop']);
    WorkshopTaxonomy::create(['workshop_id' => $outdoorWorkshop->id, 'category_id' => $cat->id, 'subcategory_id' => $sub->id, 'specialization_id' => $specB->id, 'is_primary' => true]);

    $response = $this->getJson('/api/v1/public/workshops?specialization=studio');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($studioWorkshop->id)
        ->not->toContain($outdoorWorkshop->id);
});

// ─── Organization fields in card resource ─────────────────────────────────────

test('WorkshopCardResource includes organization name but not contact details', function () {
    discoveryWorkshop(['title' => 'Org Test Workshop']);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();

    $workshop = collect($response->json('data'))->firstWhere('title', 'Org Test Workshop');
    expect($workshop)->not->toBeNull();

    // Organization should expose id and name only
    expect($workshop['organization'])->toHaveKeys(['id', 'name']);
    expect($workshop['organization'])->not->toHaveKey('primary_contact_email');
    expect($workshop['organization'])->not->toHaveKey('primary_contact_phone');
    expect($workshop['organization'])->not->toHaveKey('primary_contact_first_name');
});

// ─── Description truncation ───────────────────────────────────────────────────

test('WorkshopCardResource truncates description to 160 characters', function () {
    $longDescription = str_repeat('A', 200);
    discoveryWorkshop(['title' => 'Truncation Test', 'description' => $longDescription]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $workshop = collect($response->json('data'))->firstWhere('title', 'Truncation Test');
    expect(strlen($workshop['description']))->toBeLessThanOrEqual(163); // 160 + possible '...'
});

// ─── Taxonomy in card resource ────────────────────────────────────────────────

test('WorkshopCardResource taxonomy contains category when assigned', function () {
    $cat = TaxonomyCategory::factory()->create(['slug' => 'arts', 'is_active' => true, 'sort_order' => 0]);
    $w   = discoveryWorkshop(['title' => 'Taxonomy Card Test']);
    WorkshopTaxonomy::create(['workshop_id' => $w->id, 'category_id' => $cat->id, 'is_primary' => true]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $workshop = collect($response->json('data'))->firstWhere('id', $w->id);
    expect($workshop['taxonomy']['category']['id'])->toBe($cat->id);
});

test('WorkshopCardResource taxonomy.category is null when no taxonomy assigned', function () {
    $w = discoveryWorkshop(['title' => 'No Taxonomy Workshop']);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $workshop = collect($response->json('data'))->firstWhere('id', $w->id);
    expect($workshop['taxonomy']['category'])->toBeNull();
});

// ─── Tags in card resource ────────────────────────────────────────────────────

test('WorkshopCardResource tags array contains tag values when tags are assigned', function () {
    $group = TaxonomyTagGroup::factory()->create(['key' => 'skill_level', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $tag   = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'beginner', 'label' => 'Beginner', 'is_active' => true, 'sort_order' => 0]);

    $w = discoveryWorkshop(['title' => 'Tagged Workshop']);
    $w->tags()->attach($tag->id);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $workshop = collect($response->json('data'))->firstWhere('id', $w->id);
    $tagValues = collect($workshop['tags'])->pluck('value');
    expect($tagValues)->toContain('beginner');
});

// ─── Combined filters ─────────────────────────────────────────────────────────

test('combining category and tag filters applies both with AND logic', function () {
    $cat = TaxonomyCategory::factory()->create(['slug' => 'photography', 'is_active' => true, 'sort_order' => 0]);
    $group = TaxonomyTagGroup::factory()->create(['key' => 'skill', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $tag   = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'beginner', 'is_active' => true, 'sort_order' => 0]);

    // Has category AND tag
    $both = discoveryWorkshop(['title' => 'Both Match']);
    WorkshopTaxonomy::create(['workshop_id' => $both->id, 'category_id' => $cat->id, 'is_primary' => true]);
    $both->tags()->attach($tag->id);

    // Has category only
    $catOnly = discoveryWorkshop(['title' => 'Category Only']);
    WorkshopTaxonomy::create(['workshop_id' => $catOnly->id, 'category_id' => $cat->id, 'is_primary' => true]);

    // Has tag only
    $tagOnly = discoveryWorkshop(['title' => 'Tag Only']);
    $tagOnly->tags()->attach($tag->id);

    $response = $this->getJson('/api/v1/public/workshops?category=photography&tag[]=beginner');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($both->id)
        ->not->toContain($catOnly->id)
        ->not->toContain($tagOnly->id);
});

// ─── Pagination structure ──────────────────────────────────────────────────────

test('discovery response includes pagination meta with total and per_page', function () {
    foreach (range(1, 3) as $i) {
        discoveryWorkshop(['start_date' => "2026-10-0{$i}", 'end_date' => "2026-10-0{$i}"]);
    }

    $response = $this->getJson('/api/v1/public/workshops?per_page=12');

    $response->assertOk()
        ->assertJsonStructure(['data', 'links', 'meta' => ['total', 'per_page', 'current_page']]);

    expect($response->json('meta.total'))->toBe(3)
        ->and($response->json('meta.per_page'))->toBe(12);
});

// ─── leader_count ────────────────────────────────────────────────────────────

test('WorkshopCardResource leader_count is an integer', function () {
    discoveryWorkshop(['title' => 'Leader Count Test']);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $workshop = collect($response->json('data'))->firstWhere('title', 'Leader Count Test');
    expect($workshop['leader_count'])->toBeInt();
});
