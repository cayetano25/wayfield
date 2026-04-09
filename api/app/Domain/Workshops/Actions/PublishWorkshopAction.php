<?php

namespace App\Domain\Workshops\Actions;

use App\Domain\Webhooks\WebhookDispatcher;
use App\Domain\Workshops\Exceptions\WorkshopPublishException;
use App\Models\Workshop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class PublishWorkshopAction
{
    public function __construct(private readonly WebhookDispatcher $webhookDispatcher) {}

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

        $fresh = $workshop->fresh();

        // Dispatch webhook event — failure must NOT fail the primary action.
        try {
            $this->webhookDispatcher->dispatch('workshop.published', $workshop->organization_id, [
                'workshop_id' => $fresh->id,
                'title' => $fresh->title,
                'workshop_type' => $fresh->workshop_type,
                'start_date' => $fresh->start_date?->toDateString(),
                'end_date' => $fresh->end_date?->toDateString(),
                'timezone' => $fresh->timezone,
                'public_page_enabled' => $fresh->public_page_enabled,
                'join_code' => $fresh->join_code,
            ]);
        } catch (\Throwable $e) {
            Log::warning('PublishWorkshopAction: webhook dispatch failed', [
                'workshop_id' => $fresh->id,
                'error' => $e->getMessage(),
            ]);
        }

        return $fresh;
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
                $sessionCount = DB::table('sessions')
                    ->where('workshop_id', $workshop->id)
                    ->count();

                if ($sessionCount === 0) {
                    $errors['sessions'][] = 'Session-based workshops must have at least one session before publishing.';
                }
            }

            // Applies to all workshop types — virtual/hybrid sessions always require a meeting URL.
            $virtualWithoutUrl = DB::table('sessions')
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
