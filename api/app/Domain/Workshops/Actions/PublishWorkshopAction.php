<?php

namespace App\Domain\Workshops\Actions;

use App\Domain\Workshops\Exceptions\WorkshopPublishException;
use App\Models\Workshop;
use Illuminate\Support\Facades\Schema;

class PublishWorkshopAction
{
    public function execute(Workshop $workshop): Workshop
    {
        if ($workshop->isArchived()) {
            throw new WorkshopPublishException([
                'workshop' => ['Archived workshops cannot be published.'],
            ]);
        }

        if ($workshop->isPublished()) {
            return $workshop;
        }

        $errors = $this->validate($workshop);

        if (! empty($errors)) {
            throw new WorkshopPublishException($errors);
        }

        $workshop->update(['status' => 'published']);

        return $workshop->fresh();
    }

    /** @return array<string, array<string>> */
    private function validate(Workshop $workshop): array
    {
        $errors = [];

        if (blank($workshop->title)) {
            $errors['title'][] = 'Workshop title is required before publishing.';
        }

        if (blank($workshop->description)) {
            $errors['description'][] = 'Workshop description is required before publishing.';
        }

        if (blank($workshop->timezone)) {
            $errors['timezone'][] = 'Workshop timezone is required before publishing.';
        }

        if ($workshop->start_date && $workshop->end_date && $workshop->start_date->gt($workshop->end_date)) {
            $errors['start_date'][] = 'Workshop start date must be on or before end date.';
        }

        // Session validation requires the sessions table (Phase 3).
        // Runs automatically once Phase 3 migrations are applied.
        if (Schema::hasTable('sessions')) {
            if ($workshop->isSessionBased()) {
                $sessionCount = \Illuminate\Support\Facades\DB::table('sessions')
                    ->where('workshop_id', $workshop->id)
                    ->count();

                if ($sessionCount === 0) {
                    $errors['sessions'][] = 'Session-based workshops must have at least one session before publishing.';
                }
            }

            // Applies to all workshop types — virtual/hybrid sessions always require a meeting URL.
            $virtualWithoutUrl = \Illuminate\Support\Facades\DB::table('sessions')
                ->where('workshop_id', $workshop->id)
                ->whereIn('delivery_type', ['virtual', 'hybrid'])
                ->whereNull('meeting_url')
                ->count();

            if ($virtualWithoutUrl > 0) {
                $errors['sessions'][] = 'All virtual and hybrid sessions must have a meeting URL before publishing.';
            }
        }

        return $errors;
    }
}
