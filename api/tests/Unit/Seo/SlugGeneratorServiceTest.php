<?php

use App\Domain\Seo\Services\SlugGeneratorService;
use Illuminate\Support\Facades\DB;

// Unit tests use the real service but mock DB for uniqueness checks.

afterEach(fn () => Mockery::close());

test('it_generates_lowercase_hyphenated_slug', function () {
    // slugify() never touches the database — no DB mock needed.
    $service = new SlugGeneratorService();
    expect($service->slugify('Pacific Northwest Photography'))
        ->toBe('pacific-northwest-photography');
});

test('it_removes_special_characters', function () {
    $service = new SlugGeneratorService();
    expect($service->slugify('Workshop: "Beginner\'s Guide" & More!'))
        ->toBe('workshop-beginners-guide-more');
});

test('it_handles_collision_with_numeric_suffix', function () {
    // Simulate: 'my-slug' exists, 'my-slug-2' is free.
    DB::shouldReceive('table')->with('workshops')->andReturnSelf();
    DB::shouldReceive('where')->andReturnSelf();
    DB::shouldReceive('exists')
        ->twice()
        ->andReturn(true, false); // first call (my-slug) → exists; second (my-slug-2) → free

    $service = new SlugGeneratorService();
    $result = $service->generate('my slug', 'workshops', 'public_slug');

    expect($result)->toBe('my-slug-2');
});

test('it_does_not_collide_with_excluded_id', function () {
    // Same slug exists but belongs to the row being updated (excludeId matches).
    // The query includes WHERE id != excludeId, so the slug is treated as free.
    DB::shouldReceive('table')->with('workshops')->andReturnSelf();
    DB::shouldReceive('where')->andReturnSelf();
    DB::shouldReceive('exists')->once()->andReturn(false); // excluded row → no collision

    $service = new SlugGeneratorService();
    $result = $service->generate('my slug', 'workshops', 'public_slug', excludeId: 42);

    expect($result)->toBe('my-slug');
});
