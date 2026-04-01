<?php

namespace App\Domain\Sessions\Services;

use App\Domain\Sessions\Exceptions\SessionPublishException;
use App\Models\Session;

class ValidateVirtualSessionPublishService
{
    /**
     * Validate that a session meets all requirements to be published.
     *
     * @throws SessionPublishException
     */
    public function validate(Session $session): void
    {
        $errors = [];

        if (blank($session->title)) {
            $errors['title'][] = 'Session title is required before publishing.';
        }

        if ($session->start_at && $session->end_at && $session->start_at->gte($session->end_at)) {
            $errors['start_at'][] = 'Session start time must be before end time.';
        }

        if ($session->requiresMeetingUrl() && blank($session->meeting_url)) {
            $deliveryLabel = $session->isVirtual() ? 'Virtual' : 'Hybrid with virtual participation';
            $errors['meeting_url'][] = "{$deliveryLabel} sessions require a meeting URL before publishing.";
        }

        if (! empty($errors)) {
            throw new SessionPublishException($errors);
        }
    }
}
