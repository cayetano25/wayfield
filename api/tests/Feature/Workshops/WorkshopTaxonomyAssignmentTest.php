<?php

use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function workshopTaxonomyFixture(): array
{
    $cat  = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $sub  = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $spec = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'is_active' => true, 'sort_order' => 0]);
    $group = TaxonomyTagGroup::factory()->create(['key' => 'format', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $tag  = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'hands_on', 'is_active' => true, 'sort_order' => 0]);

    return compact('cat', 'sub', 'spec', 'group', 'tag');
}

function workshopTaxPayload(): array
{
    return [
        'workshop_type' => 'event_based',
        'title'         => 'Taxonomy Workshop',
        'description'   => 'A workshop for testing taxonomy.',
        'timezone'      => 'UTC',
        'start_date'    => '2026-09-01',
        'end_date'      => '2026-09-03',
    ];
}

// ─── Create endpoint ──────────────────────────────────────────────────────────

test('POST /workshops creates a workshop_taxonomy row when category_id is provided', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat] = workshopTaxonomyFixture();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopTaxPayload() + [
            'category_id' => $cat->id,
        ]);

    $response->assertStatus(201);

    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id' => $response->json('id'),
        'category_id' => $cat->id,
        'is_primary'  => true,
    ]);
});

test('POST /workshops response includes taxonomy key with category details', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'sub' => $sub, 'spec' => $spec] = workshopTaxonomyFixture();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", workshopTaxPayload() + [
            'category_id'       => $cat->id,
            'subcategory_id'    => $sub->id,
            'specialization_id' => $spec->id,
        ]);

    $response->assertStatus(201)
        ->assertJsonStructure(['taxonomy' => ['category', 'subcategory', 'specialization', 'tags']])
        ->assertJsonPath('taxonomy.category.id', $cat->id)
        ->assertJsonPath('taxonomy.subcategory.id', $sub->id)
        ->assertJsonPath('taxonomy.specialization.id', $spec->id);
});

// ─── Update endpoint ──────────────────────────────────────────────────────────

test('PATCH /workshops updates taxonomy and returns updated category in response', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'sub' => $sub] = workshopTaxonomyFixture();
    $catB = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 1]);

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $workshop->taxonomies()->create(['category_id' => $cat->id, 'is_primary' => true]);

    $response = $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", ['category_id' => $catB->id]);

    $response->assertOk()
        ->assertJsonPath('taxonomy.category.id', $catB->id);

    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id' => $workshop->id,
        'category_id' => $catB->id,
        'is_primary'  => true,
    ]);
    expect($workshop->taxonomies()->count())->toBe(1);
});

test('PATCH with tag_ids syncs tags, replacing previous assignments', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'tag' => $tagA] = workshopTaxonomyFixture();
    $group = TaxonomyTagGroup::factory()->create(['key' => 'level', 'is_active' => true, 'sort_order' => 1, 'allows_multiple' => false]);
    $tagB  = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'beginner', 'is_active' => true, 'sort_order' => 0]);

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $workshop->tags()->attach($tagA->id);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", [
            'category_id' => $cat->id,
            'tag_ids'     => [$tagB->id],
        ])
        ->assertOk();

    $this->assertDatabaseHas('workshop_tags', ['workshop_id' => $workshop->id, 'tag_id' => $tagB->id]);
    $this->assertDatabaseMissing('workshop_tags', ['workshop_id' => $workshop->id, 'tag_id' => $tagA->id]);
});

test('PATCH with tag_ids=[] removes all existing tags', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'tag' => $tag] = workshopTaxonomyFixture();

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $workshop->taxonomies()->create(['category_id' => $cat->id, 'is_primary' => true]);
    $workshop->tags()->attach($tag->id);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", [
            'category_id' => $cat->id,
            'tag_ids'     => [],
        ])
        ->assertOk()
        ->assertJsonPath('taxonomy.tags', []);

    $this->assertDatabaseMissing('workshop_tags', ['workshop_id' => $workshop->id]);
});

// ─── Validation ───────────────────────────────────────────────────────────────

test('PATCH rejects subcategory_id belonging to wrong category', function () {
    [$user, $org] = makeOwner();
    $catA = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $catB = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 1]);
    $subForB = TaxonomySubcategory::factory()->create(['category_id' => $catB->id, 'is_active' => true, 'sort_order' => 0]);

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", [
            'category_id'    => $catA->id,
            'subcategory_id' => $subForB->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['subcategory_id']);
});

test('PATCH rejects specialization_id belonging to wrong subcategory', function () {
    [$user, $org] = makeOwner();
    $cat  = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $subA = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $subB = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 1]);
    $specForB = TaxonomySpecialization::factory()->create(['subcategory_id' => $subB->id, 'is_active' => true, 'sort_order' => 0]);

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", [
            'category_id'       => $cat->id,
            'subcategory_id'    => $subA->id,
            'specialization_id' => $specForB->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['specialization_id']);
});

// ─── Taxonomy is null when unassigned ─────────────────────────────────────────

test('OrganizerWorkshopResource taxonomy.category is null when no taxonomy assigned', function () {
    [$user, $org] = makeOwner();

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}");

    $response->assertOk()
        ->assertJsonPath('taxonomy.category', null)
        ->assertJsonPath('taxonomy.tags', []);
});
