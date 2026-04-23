<?php

declare(strict_types=1);

use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Rules\SubcategoryBelongsToCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('passes when subcategory belongs to the given category', function () {
    $cat = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $sub = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);

    $failed = false;
    $rule = new SubcategoryBelongsToCategory($cat->id);
    $rule->validate('subcategory_id', $sub->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

test('fails when subcategory belongs to a different category', function () {
    $catA = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $catB = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 1]);
    $subForB = TaxonomySubcategory::factory()->create(['category_id' => $catB->id, 'is_active' => true, 'sort_order' => 0]);

    $failed = false;
    $rule = new SubcategoryBelongsToCategory($catA->id);
    $rule->validate('subcategory_id', $subForB->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeTrue();
});

test('fails when categoryId is null', function () {
    $cat = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $sub = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);

    $failed = false;
    $rule = new SubcategoryBelongsToCategory(null);
    $rule->validate('subcategory_id', $sub->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeTrue();
});
