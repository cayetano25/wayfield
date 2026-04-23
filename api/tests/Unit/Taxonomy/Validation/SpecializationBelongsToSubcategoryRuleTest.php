<?php

declare(strict_types=1);

use App\Models\TaxonomyCategory;
use App\Models\TaxonomySpecialization;
use App\Models\TaxonomySubcategory;
use App\Rules\SpecializationBelongsToSubcategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

test('passes when specialization belongs to the given subcategory', function () {
    $cat  = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $sub  = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $spec = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'is_active' => true, 'sort_order' => 0]);

    $failed = false;
    $rule = new SpecializationBelongsToSubcategory($sub->id);
    $rule->validate('specialization_id', $spec->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeFalse();
});

test('fails when specialization belongs to a different subcategory', function () {
    $cat  = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $subA = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $subB = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 1]);
    $specForB = TaxonomySpecialization::factory()->create(['subcategory_id' => $subB->id, 'is_active' => true, 'sort_order' => 0]);

    $failed = false;
    $rule = new SpecializationBelongsToSubcategory($subA->id);
    $rule->validate('specialization_id', $specForB->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeTrue();
});

test('fails when subcategoryId is null', function () {
    $cat  = TaxonomyCategory::factory()->create(['is_active' => true, 'sort_order' => 0]);
    $sub  = TaxonomySubcategory::factory()->create(['category_id' => $cat->id, 'is_active' => true, 'sort_order' => 0]);
    $spec = TaxonomySpecialization::factory()->create(['subcategory_id' => $sub->id, 'is_active' => true, 'sort_order' => 0]);

    $failed = false;
    $rule = new SpecializationBelongsToSubcategory(null);
    $rule->validate('specialization_id', $spec->id, function () use (&$failed) {
        $failed = true;
    });

    expect($failed)->toBeTrue();
});
