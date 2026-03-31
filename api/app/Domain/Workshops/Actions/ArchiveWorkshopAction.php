<?php

namespace App\Domain\Workshops\Actions;

use App\Models\Workshop;

class ArchiveWorkshopAction
{
    public function execute(Workshop $workshop): Workshop
    {
        if ($workshop->isArchived()) {
            return $workshop;
        }

        $workshop->update(['status' => 'archived']);

        return $workshop->fresh();
    }
}
