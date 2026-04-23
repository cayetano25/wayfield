<?php

use App\Models\Organization;
use App\Models\Session;
use App\Models\TaxonomyCategory;
use App\Models\TaxonomySubcategory;
use App\Models\TaxonomyTag;
use App\Models\TaxonomyTagGroup;
use App\Models\Workshop;
use App\Models\WorkshopTaxonomy;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function publishedWorkshop(array $attrs = []): Workshop
{
    $org = Organization::factory()->create();
    return Workshop::factory()->create(array_merge([
        'organization_id'     => $org->id,
        'status'              => 'published',
        'public_page_enabled' => true,
        'public_slug'         => 'workshop-'.uniqid(),
        'start_date'          => '2026-10-01',
        'end_date'            => '2026-10-03',
    ], $attrs));
}

// ─── Base filter ─────────────────────────────────────────────────────────────

test('GET /public/workshops returns only published and public_page_enabled workshops', function () {
    $published = publishedWorkshop();
    $draft = Workshop::factory()->create(['status' => 'draft', 'public_page_enabled' => true]);
    $notPublic = Workshop::factory()->create(['status' => 'published', 'public_page_enabled' => false]);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($published->id)
        ->not->toContain($draft->id)
        ->not->toContain($notPublic->id);
});

test('response never includes join_code', function () {
    publishedWorkshop();

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk();
    $json = $response->json();
    $encoded = json_encode($json);
    expect($encoded)->not->toContain('join_code');
});

test('WorkshopCardResource includes expected fields', function () {
    publishedWorkshop(['title' => 'My Workshop']);

    $response = $this->getJson('/api/v1/public/workshops');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'title', 'description', 'status', 'start_date', 'end_date', 'public_slug', 'public_page_enabled', 'workshop_type', 'taxonomy', 'tags', 'organization', 'leader_count'],
            ],
        ]);
});

// ─── Category filter ─────────────────────────────────────────────────────────

test('filter by category slug returns only workshops in that category', function () {
    $cat = TaxonomyCategory::factory()->create(['slug' => 'photography', 'is_active' => true, 'sort_order' => 0]);
    $other = TaxonomyCategory::factory()->create(['slug' => 'culinary', 'is_active' => true, 'sort_order' => 1]);

    $photoWorkshop = publishedWorkshop(['title' => 'Photo Workshop']);
    WorkshopTaxonomy::create(['workshop_id' => $photoWorkshop->id, 'category_id' => $cat->id, 'is_primary' => true]);

    $culinaryWorkshop = publishedWorkshop(['title' => 'Cooking Class']);
    WorkshopTaxonomy::create(['workshop_id' => $culinaryWorkshop->id, 'category_id' => $other->id, 'is_primary' => true]);

    $untagged = publishedWorkshop(['title' => 'Untagged Workshop']);

    $response = $this->getJson('/api/v1/public/workshops?category=photography');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($photoWorkshop->id)
        ->not->toContain($culinaryWorkshop->id)
        ->not->toContain($untagged->id);
});

// ─── Tag filter (AND logic) ───────────────────────────────────────────────────

test('filter by single tag returns workshops with that tag', function () {
    $group = TaxonomyTagGroup::factory()->create(['key' => 'skill_level', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $beginner = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'beginner', 'label' => 'Beginner', 'is_active' => true, 'sort_order' => 0]);
    $advanced = TaxonomyTag::factory()->create(['tag_group_id' => $group->id, 'value' => 'advanced', 'label' => 'Advanced', 'is_active' => true, 'sort_order' => 1]);

    $beginnerWorkshop = publishedWorkshop(['title' => 'Beginner Class']);
    $beginnerWorkshop->tags()->attach($beginner->id);

    $advancedWorkshop = publishedWorkshop(['title' => 'Advanced Class']);
    $advancedWorkshop->tags()->attach($advanced->id);

    $response = $this->getJson('/api/v1/public/workshops?tag[]=beginner');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($beginnerWorkshop->id)->not->toContain($advancedWorkshop->id);
});

test('filter by multiple tags uses AND logic', function () {
    $groupA = TaxonomyTagGroup::factory()->create(['key' => 'format', 'is_active' => true, 'sort_order' => 0, 'allows_multiple' => false]);
    $handsOn = TaxonomyTag::factory()->create(['tag_group_id' => $groupA->id, 'value' => 'hands_on', 'label' => 'Hands-On', 'is_active' => true, 'sort_order' => 0]);

    $groupB = TaxonomyTagGroup::factory()->create(['key' => 'skill_level', 'is_active' => true, 'sort_order' => 1, 'allows_multiple' => false]);
    $beginner = TaxonomyTag::factory()->create(['tag_group_id' => $groupB->id, 'value' => 'beginner', 'label' => 'Beginner', 'is_active' => true, 'sort_order' => 0]);

    // Workshop A has BOTH tags
    $both = publishedWorkshop(['title' => 'Both Tags']);
    $both->tags()->attach([$handsOn->id, $beginner->id]);

    // Workshop B has only one tag
    $one = publishedWorkshop(['title' => 'One Tag']);
    $one->tags()->attach($handsOn->id);

    $response = $this->getJson('/api/v1/public/workshops?tag[]=hands_on&tag[]=beginner');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($both->id)->not->toContain($one->id);
});

// ─── Date filters ─────────────────────────────────────────────────────────────

test('start_after filter excludes workshops before the date', function () {
    $early = publishedWorkshop(['start_date' => '2026-01-01', 'end_date' => '2026-01-03']);
    $late  = publishedWorkshop(['start_date' => '2026-12-01', 'end_date' => '2026-12-03']);

    $response = $this->getJson('/api/v1/public/workshops?start_after=2026-06-01');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($late->id)->not->toContain($early->id);
});

test('start_before filter excludes workshops after the date', function () {
    $early = publishedWorkshop(['start_date' => '2026-01-01', 'end_date' => '2026-01-03']);
    $late  = publishedWorkshop(['start_date' => '2026-12-01', 'end_date' => '2026-12-03']);

    $response = $this->getJson('/api/v1/public/workshops?start_before=2026-06-01');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($early->id)->not->toContain($late->id);
});

// ─── Keyword search ───────────────────────────────────────────────────────────

test('q filter returns workshops matching title or description', function () {
    $match = publishedWorkshop(['title' => 'Landscape Photography', 'description' => 'A full landscape workshop.']);
    $noMatch = publishedWorkshop(['title' => 'Cooking Class', 'description' => 'Learn to cook.']);

    $response = $this->getJson('/api/v1/public/workshops?q=landscape');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($match->id)->not->toContain($noMatch->id);
});

// ─── Delivery type filter ─────────────────────────────────────────────────────

test('delivery_type filter returns workshops with matching published session delivery_type', function () {
    $virtualWorkshop = publishedWorkshop(['title' => 'Virtual Class']);
    Session::factory()->create([
        'workshop_id'   => $virtualWorkshop->id,
        'is_published'  => true,
        'delivery_type' => 'virtual',
        'start_at'      => '2026-10-01 09:00:00',
        'end_at'        => '2026-10-01 12:00:00',
    ]);

    $inPersonWorkshop = publishedWorkshop(['title' => 'In Person Class']);
    Session::factory()->create([
        'workshop_id'   => $inPersonWorkshop->id,
        'is_published'  => true,
        'delivery_type' => 'in_person',
        'start_at'      => '2026-10-01 09:00:00',
        'end_at'        => '2026-10-01 12:00:00',
    ]);

    $response = $this->getJson('/api/v1/public/workshops?delivery_type=virtual');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');
    expect($ids)->toContain($virtualWorkshop->id)->not->toContain($inPersonWorkshop->id);
});

// ─── Pagination ───────────────────────────────────────────────────────────────

test('per_page parameter controls page size', function () {
    foreach (range(1, 5) as $i) {
        publishedWorkshop(['start_date' => "2026-10-0{$i}", 'end_date' => "2026-10-0{$i}"]);
    }

    $response = $this->getJson('/api/v1/public/workshops?per_page=12');

    $response->assertOk()
        ->assertJsonStructure(['data', 'links', 'meta']);
});

test('invalid per_page value returns validation error', function () {
    $this->getJson('/api/v1/public/workshops?per_page=100')
        ->assertStatus(422);
});

// ─── Sort ─────────────────────────────────────────────────────────────────────

test('sort=newest orders by created_at descending', function () {
    $first = publishedWorkshop(['start_date' => '2026-10-01', 'end_date' => '2026-10-03']);
    $first->forceFill(['created_at' => now()->subDays(2)])->saveQuietly();

    $second = publishedWorkshop(['start_date' => '2026-11-01', 'end_date' => '2026-11-03']);
    $second->forceFill(['created_at' => now()->subDay()])->saveQuietly();

    $response = $this->getJson('/api/v1/public/workshops?sort=newest');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id')->values()->all();
    // newest first: $second (created more recently) should appear before $first
    expect(array_search($second->id, $ids))->toBeLessThan(array_search($first->id, $ids));
});

test('sort=start_date orders by start_date ascending', function () {
    $later = publishedWorkshop(['start_date' => '2026-12-01', 'end_date' => '2026-12-03']);
    $earlier = publishedWorkshop(['start_date' => '2026-09-01', 'end_date' => '2026-09-03']);

    $response = $this->getJson('/api/v1/public/workshops?sort=start_date');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id')->values()->all();
    expect(array_search($earlier->id, $ids))->toBeLessThan(array_search($later->id, $ids));
});
