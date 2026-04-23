<?php

use App\Models\Organization;
use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function taxonomyFixture(): array
{
    $cat = TaxonomyCategory::factory()->create(['slug' => 'photography', 'is_active' => true, 'sort_order' => 0]);
    $sub = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'slug' => 'portrait', 'is_active' => true, 'sort_order' => 0]);
    $spec = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'slug' => 'studio-portrait', 'is_active' => true, 'sort_order' => 0]);

    $group = TaxonomyTagGroup::factory()->create(['key' => 'skill_level', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $tag = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'beginner', 'label' => 'Beginner', 'is_active' => true, 'sort_order' => 0]);

    return compact('cat', 'sub', 'spec', 'group', 'tag');
}

function taxonomyWorkshopPayload(): array
{
    return [
        'workshop_type' => 'event_based',
        'title'         => 'Test Workshop',
        'description'   => 'A test workshop.',
        'timezone'      => 'UTC',
        'start_date'    => '2026-09-01',
        'end_date'      => '2026-09-03',
    ];
}

// ─── Create with taxonomy ─────────────────────────────────────────────────────

test('owner can create a workshop with category, subcategory, and tags', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'sub' => $sub, 'spec' => $spec, 'tag' => $tag] = taxonomyFixture();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload() + [
            'category_id'       => $cat->id,
            'subcategory_id'    => $sub->id,
            'specialization_id' => $spec->id,
            'tag_ids'           => [$tag->id],
        ]);

    $response->assertStatus(201);

    $workshopId = $response->json('id');
    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id'    => $workshopId,
        'category_id'    => $cat->id,
        'subcategory_id' => $sub->id,
        'is_primary'     => true,
    ]);
    $this->assertDatabaseHas('workshop_tags', [
        'workshop_id' => $workshopId,
        'tag_id'      => $tag->id,
    ]);
});

test('taxonomy key is present in create response', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'sub' => $sub] = taxonomyFixture();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload() + [
            'category_id'    => $cat->id,
            'subcategory_id' => $sub->id,
        ]);

    $response->assertStatus(201)
        ->assertJsonStructure(['taxonomy' => ['category', 'subcategory', 'specialization', 'tags']]);

    expect($response->json('taxonomy.category.id'))->toBe($cat->id);
    expect($response->json('taxonomy.subcategory.id'))->toBe($sub->id);
});

test('creating workshop without taxonomy fields leaves taxonomy null', function () {
    [$user, $org] = makeOwner();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload());

    $response->assertStatus(201)
        ->assertJsonPath('taxonomy.category', null)
        ->assertJsonPath('taxonomy.tags', []);

    $workshopId = $response->json('id');
    $this->assertDatabaseMissing('workshop_taxonomy', ['workshop_id' => $workshopId]);
});

// ─── Update with taxonomy ─────────────────────────────────────────────────────

test('owner can update workshop taxonomy', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'sub' => $sub, 'tag' => $tag] = taxonomyFixture();

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", [
            'category_id'    => $cat->id,
            'subcategory_id' => $sub->id,
            'tag_ids'        => [$tag->id],
        ]);

    $response->assertOk()
        ->assertJsonPath('taxonomy.category.id', $cat->id)
        ->assertJsonPath('taxonomy.subcategory.id', $sub->id);

    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id'    => $workshop->id,
        'category_id'    => $cat->id,
        'subcategory_id' => $sub->id,
        'is_primary'     => true,
    ]);
    $this->assertDatabaseHas('workshop_tags', [
        'workshop_id' => $workshop->id,
        'tag_id'      => $tag->id,
    ]);
});

test('sending category_id null clears taxonomy and tags', function () {
    [$user, $org] = makeOwner();
    ['cat' => $cat, 'tag' => $tag] = taxonomyFixture();

    $workshop = Workshop::factory()->create(['organization_id' => $org->id]);
    $workshop->taxonomies()->create(['category_id' => $cat->id, 'is_primary' => true]);
    $workshop->tags()->attach($tag->id);

    $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/workshops/{$workshop->id}", ['category_id' => null])
        ->assertOk()
        ->assertJsonPath('taxonomy.category', null)
        ->assertJsonPath('taxonomy.tags', []);

    $this->assertDatabaseMissing('workshop_taxonomy', ['workshop_id' => $workshop->id]);
    $this->assertDatabaseMissing('workshop_tags', ['workshop_id' => $workshop->id]);
});

// ─── Validation ───────────────────────────────────────────────────────────────

test('validation rejects subcategory_id that belongs to a different category', function () {
    [$user, $org] = makeOwner();

    $catA = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $catB = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 1]);
    $subForB = TaxonomySubcategory::factory()->create(['category_id' => $catB->id, 'is_active' => true, 'sort_order' => 0]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload() + [
            'category_id'    => $catA->id,
            'subcategory_id' => $subForB->id, // belongs to catB, not catA
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['subcategory_id']);
});

test('validation rejects specialization_id that belongs to a different subcategory', function () {
    [$user, $org] = makeOwner();

    $cat = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $subA = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $subB = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 1]);
    $specForB = TaxonomySpecialization::factory()->create(['subcategory_id' => $subB->id, 'is_active' => true, 'sort_order' => 0]);

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload() + [
            'category_id'       => $cat->id,
            'subcategory_id'    => $subA->id,
            'specialization_id' => $specForB->id, // belongs to subB, not subA
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['specialization_id']);
});

test('validation rejects inactive category_id', function () {
    [$user, $org] = makeOwner();
    $inactive = TaxonomyCategory::factory()->create(['is_active' => false, 'sort_order' => 0]);

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload() + [
            'category_id' => $inactive->id,
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['category_id']);
});

test('validation rejects tag_ids that do not exist', function () {
    [$user, $org] = makeOwner();

    $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/workshops", taxonomyWorkshopPayload() + [
            'tag_ids' => [999999],
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['tag_ids.0']);
});
