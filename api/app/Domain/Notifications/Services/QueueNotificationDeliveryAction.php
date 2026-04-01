<?php

namespace App\Domain\Notifications\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendPushNotificationJob;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use Illuminate\Support\Collection;

class QueueNotificationDeliveryAction
{
    /**
     * Dispatch queued delivery jobs for all recipients of a notification.
     *
     * - Email: one job per recipient with email_status = 'pending'
     * - Push: one job per recipient with push_status = 'pending' (the job
     *   fetches active tokens internally — a user may have multiple devices)
     *
     * Jobs are dispatched asynchronously; delivery is never synchronous.
     */
    public function dispatch(Notification $notification, Collection $recipients): void
    {
        foreach ($recipients as $recipient) {
            /** @var NotificationRecipient $recipient */

            if ($recipient->email_status === 'pending') {
                SendEmailNotificationJob::dispatch($notification->id, $recipient->id);
            }

            if ($recipient->push_status === 'pending') {
                SendPushNotificationJob::dispatch($notification->id, $recipient->id);
            }
        }
    }
}
