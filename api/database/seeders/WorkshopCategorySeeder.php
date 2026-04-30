<?php

namespace Database\Seeders;

use App\Domain\Seo\Models\WorkshopCategory;
use Illuminate\Database\Seeder;

class WorkshopCategorySeeder extends Seeder
{
    private const CATEGORIES = [
        ['name' => 'Photography',           'slug' => 'photography',            'sort_order' => 1],
        ['name' => 'Portrait Photography',  'slug' => 'portrait-photography',   'sort_order' => 2],
        ['name' => 'Landscape Photography', 'slug' => 'landscape-photography',  'sort_order' => 3],
        ['name' => 'Wildlife Photography',  'slug' => 'wildlife-photography',   'sort_order' => 4],
        ['name' => 'Wedding Photography',   'slug' => 'wedding-photography',    'sort_order' => 5],
        ['name' => 'Street Photography',    'slug' => 'street-photography',     'sort_order' => 6],
        ['name' => 'Studio Photography',    'slug' => 'studio-photography',     'sort_order' => 7],
        ['name' => 'Travel Photography',    'slug' => 'travel-photography',     'sort_order' => 8],
        ['name' => 'Creative Education',    'slug' => 'creative-education',     'sort_order' => 9],
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $category) {
            WorkshopCategory::firstOrCreate(
                ['slug' => $category['slug']],
                [
                    'name'       => $category['name'],
                    'sort_order' => $category['sort_order'],
                    'is_active'  => true,
                ],
            );
        }
    }
}
