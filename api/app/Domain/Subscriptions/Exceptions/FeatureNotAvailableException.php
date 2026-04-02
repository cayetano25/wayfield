<?php

namespace App\Domain\Subscriptions\Exceptions;

use RuntimeException;

class FeatureNotAvailableException extends RuntimeException
{
    public function __construct(
        public readonly string $featureKey,
        public readonly string $requiredPlan,
        string $message = 'Your current plan does not support this action.',
    ) {
        parent::__construct($message);
    }
}
