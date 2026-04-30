<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\WorkshopPriceTier;

class TierSchedulingService
{
    public function scheduleJobsForTier(WorkshopPriceTier $tier): void
    {
        $this->cancelJobsForTier($tier);

        if ($tier->valid_until === null || ! $tier->valid_until->isFuture()) {
            return;
        }

        // 48-hour expiry reminder (N-67) sent to organizer.
        $reminderAt = $tier->valid_until->copy()->subHours(48);
        if ($reminderAt->isFuture()) {
            ScheduledPaymentJob::create([
                'job_type'            => 'price_tier_expiry_reminder',
                'notification_code'   => 'N-67',
                'related_entity_type' => 'workshop_price_tier',
                'related_entity_id'   => $tier->id,
                'scheduled_for'       => $reminderAt,
                'status'              => 'pending',
            ]);
        }

        // Tier-activated notification (N-68) for the next tier, fired 1s after this one expires.
        $nextTier = WorkshopPriceTier::query()
            ->where('workshop_id', $tier->workshop_id)
            ->where('sort_order', '>', $tier->sort_order)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->first();

        if ($nextTier !== null) {
            ScheduledPaymentJob::create([
                'job_type'            => 'price_tier_activated',
                'notification_code'   => 'N-68',
                'related_entity_type' => 'workshop_price_tier',
                'related_entity_id'   => $nextTier->id,
                'scheduled_for'       => $tier->valid_until->copy()->addSecond(),
                'status'              => 'pending',
            ]);
        }
    }

    public function cancelJobsForTier(WorkshopPriceTier $tier): void
    {
        ScheduledPaymentJob::query()
            ->where('related_entity_type', 'workshop_price_tier')
            ->where('related_entity_id', $tier->id)
            ->where('status', 'pending')
            ->each(fn ($job) => $job->cancel('tier_updated_or_deleted'));
    }
}
