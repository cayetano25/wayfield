<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TaxonomyCategory;
use App\Models\TaxonomyTagGroup;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class TaxonomyController extends Controller
{
    /**
     * GET /api/v1/taxonomy
     *
     * Full taxonomy tree: all active categories with subcategories+specializations,
     * plus all active tag groups with their tags. Cached for 60 minutes.
     */
    public function index(): JsonResponse
    {
        $data = Cache::remember('taxonomy.full_tree', 3600, function () {
            $categories = TaxonomyCategory::active()
                ->with([
                    'subcategories' => fn ($q) => $q->active()
                        ->with(['specializations' => fn ($q2) => $q2->active()]),
                ])
                ->get();

            $tagGroups = TaxonomyTagGroup::active()
                ->with(['tags' => fn ($q) => $q->active()])
                ->get();

            return [
                'categories' => $categories->map(fn ($cat) => [
                    'id'         => $cat->id,
                    'name'       => $cat->name,
                    'slug'       => $cat->slug,
                    'sort_order' => $cat->sort_order,
                    'subcategories' => $cat->subcategories->map(fn ($sub) => [
                        'id'          => $sub->id,
                        'name'        => $sub->name,
                        'slug'        => $sub->slug,
                        'category_id' => $sub->category_id,
                        'sort_order'  => $sub->sort_order,
                        'specializations' => $sub->specializations->map(fn ($spec) => [
                            'id'             => $spec->id,
                            'name'           => $spec->name,
                            'slug'           => $spec->slug,
                            'subcategory_id' => $spec->subcategory_id,
                            'sort_order'     => $spec->sort_order,
                        ])->values()->toArray(),
                    ])->values()->toArray(),
                ])->values()->toArray(),

                'tag_groups' => $tagGroups->map(fn ($group) => [
                    'id'              => $group->id,
                    'key'             => $group->key,
                    'label'           => $group->label,
                    'allows_multiple' => $group->allows_multiple,
                    'sort_order'      => $group->sort_order,
                    'tags'            => $group->tags->map(fn ($tag) => [
                        'id'         => $tag->id,
                        'value'      => $tag->value,
                        'label'      => $tag->label,
                        'sort_order' => $tag->sort_order,
                    ])->values()->toArray(),
                ])->values()->toArray(),
            ];
        });

        return response()->json($data);
    }

    /**
     * GET /api/v1/taxonomy/categories
     *
     * Lightweight flat list of active categories for dropdowns/selectors.
     */
    public function categories(): JsonResponse
    {
        $categories = TaxonomyCategory::active()->get(['id', 'name', 'slug', 'sort_order']);

        return response()->json([
            'categories' => $categories->map(fn ($cat) => [
                'id'         => $cat->id,
                'name'       => $cat->name,
                'slug'       => $cat->slug,
                'sort_order' => $cat->sort_order,
            ])->values(),
        ]);
    }

    /**
     * GET /api/v1/taxonomy/categories/{category:slug}/subcategories
     *
     * Subcategories for a given category with their specializations nested.
     */
    public function subcategories(TaxonomyCategory $category): JsonResponse
    {
        if (! $category->is_active) {
            return response()->json(['message' => 'Category not found.'], 404);
        }

        $subcategories = $category->subcategories()
            ->active()
            ->with(['specializations' => fn ($q) => $q->active()])
            ->get();

        return response()->json([
            'category'      => ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug],
            'subcategories' => $subcategories->map(fn ($sub) => [
                'id'          => $sub->id,
                'name'        => $sub->name,
                'slug'        => $sub->slug,
                'category_id' => $sub->category_id,
                'sort_order'  => $sub->sort_order,
                'specializations' => $sub->specializations->map(fn ($spec) => [
                    'id'             => $spec->id,
                    'name'           => $spec->name,
                    'slug'           => $spec->slug,
                    'subcategory_id' => $spec->subcategory_id,
                    'sort_order'     => $spec->sort_order,
                ])->values(),
            ])->values(),
        ]);
    }
}
