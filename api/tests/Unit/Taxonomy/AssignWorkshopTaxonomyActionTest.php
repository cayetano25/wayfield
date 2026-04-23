<?php

declare(strict_types=1);

use App\Domain\Taxonomy\Actions\AssignWorkshopTaxonomyAction;
use App\Models\Organization;
use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

function makeWorkshop(): Workshop
{
    return Workshop::factory()->create([
        'organization_id' => Organization::factory()->create()->id,
    ]);
}

function makeTaxonomyTree(): array
{
    $cat  = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $sub  = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $spec = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'is_active' => true, 'sort_order' => 0]);
    $group = TaxonomyTagGroup::factory()->create(['key' => 'skill_level', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $tag  = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'is_active' => true, 'sort_order' => 0]);

    return compact('cat', 'sub', 'spec', 'group', 'tag');
}

// ─── assign() ─────────────────────────────────────────────────────────────────

test('assign creates a primary taxonomy row for the workshop', function () {
    $workshop = makeWorkshop();
    ['cat' => $cat] = makeTaxonomyTree();

    (new AssignWorkshopTaxonomyAction)->assign($workshop, ['category_id' => $cat->id]);

    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id' => $workshop->id,
        'category_id' => $cat->id,
        'is_primary'  => true,
    ]);
});

test('assign stores subcategory and specialization IDs', function () {
    $workshop = makeWorkshop();
    ['cat' => $cat, 'sub' => $sub, 'spec' => $spec] = makeTaxonomyTree();

    (new AssignWorkshopTaxonomyAction)->assign($workshop, [
        'category_id'       => $cat->id,
        'subcategory_id'    => $sub->id,
        'specialization_id' => $spec->id,
    ]);

    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id'       => $workshop->id,
        'category_id'       => $cat->id,
        'subcategory_id'    => $sub->id,
        'specialization_id' => $spec->id,
        'is_primary'        => true,
    ]);
});

test('assign syncs tags onto the workshop', function () {
    $workshop = makeWorkshop();
    ['cat' => $cat, 'tag' => $tag] = makeTaxonomyTree();

    (new AssignWorkshopTaxonomyAction)->assign($workshop, [
        'category_id' => $cat->id,
        'tag_ids'     => [$tag->id],
    ]);

    $this->assertDatabaseHas('workshop_tags', [
        'workshop_id' => $workshop->id,
        'tag_id'      => $tag->id,
    ]);
});

test('second assign call updates the existing primary row without creating a duplicate', function () {
    $workshop = makeWorkshop();
    ['cat' => $cat] = makeTaxonomyTree();
    $cat2 = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 1]);

    $action = new AssignWorkshopTaxonomyAction;
    $action->assign($workshop, ['category_id' => $cat->id]);
    $action->assign($workshop, ['category_id' => $cat2->id]);

    expect($workshop->taxonomies()->count())->toBe(1);
    $this->assertDatabaseHas('workshop_taxonomy', [
        'workshop_id' => $workshop->id,
        'category_id' => $cat2->id,
        'is_primary'  => true,
    ]);
});

test('assign with null category_id deletes all taxonomy rows and tags', function () {
    $workshop = makeWorkshop();
    ['cat' => $cat, 'tag' => $tag] = makeTaxonomyTree();

    $workshop->taxonomies()->create(['category_id' => $cat->id, 'is_primary' => true]);
    $workshop->tags()->attach($tag->id);

    (new AssignWorkshopTaxonomyAction)->assign($workshop, ['category_id' => null]);

    $this->assertDatabaseMissing('workshop_taxonomy', ['workshop_id' => $workshop->id]);
    $this->assertDatabaseMissing('workshop_tags', ['workshop_id' => $workshop->id]);
});

test('assign with empty tag_ids removes existing tags', function () {
    $workshop = makeWorkshop();
    ['cat' => $cat, 'tag' => $tag] = makeTaxonomyTree();

    $workshop->tags()->attach($tag->id);

    (new AssignWorkshopTaxonomyAction)->assign($workshop, [
        'category_id' => $cat->id,
        'tag_ids'     => [],
    ]);

    $this->assertDatabaseMissing('workshop_tags', ['workshop_id' => $workshop->id]);
});
