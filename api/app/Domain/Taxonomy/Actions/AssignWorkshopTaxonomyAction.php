<?php

namespace App\Domain\Taxonomy\Actions;

use App\Models\Workshop;

class AssignWorkshopTaxonomyAction
{
    public function assign(Workshop $workshop, array $data): void
    {
        $categoryId = $data['category_id'] ?? null;

        if ($categoryId === null) {
            $workshop->taxonomies()->delete();
            $workshop->tags()->detach();
            return;
        }

        // Upsert the primary taxonomy row for this workshop.
        // Using where('is_primary', true) as the lookup key so changing the
        // category/subcategory updates the existing primary row in-place.
        $workshop->taxonomies()->updateOrCreate(
            ['is_primary' => true],
            [
                'category_id'       => $categoryId,
                'subcategory_id'    => $data['subcategory_id'] ?? null,
                'specialization_id' => $data['specialization_id'] ?? null,
            ]
        );

        $workshop->tags()->sync($data['tag_ids'] ?? []);
    }
}
