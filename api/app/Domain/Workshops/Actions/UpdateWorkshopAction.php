<?php

namespace App\Domain\Workshops\Actions;

use App\Domain\Taxonomy\Actions\AssignWorkshopTaxonomyAction;
use App\Models\Workshop;

class UpdateWorkshopAction
{
    private const ALLOWED_FIELDS = [
        'title',
        'description',
        'timezone',
        'start_date',
        'end_date',
        'default_location_id',
        'public_page_enabled',
        // public_slug is immutable after creation — never updated here
    ];

    public function __construct(
        private readonly AssignWorkshopTaxonomyAction $taxonomyAction,
    ) {}

    public function execute(Workshop $workshop, array $data): Workshop
    {
        if ($workshop->isArchived()) {
            throw new \LogicException('Archived workshops cannot be modified.');
        }

        $updates = array_intersect_key($data, array_flip(self::ALLOWED_FIELDS));

        if (! empty($updates)) {
            $workshop->update($updates);
        }

        if (array_key_exists('category_id', $data)) {
            $this->taxonomyAction->assign($workshop, $data);
        }

        return $workshop->fresh();
    }
}
