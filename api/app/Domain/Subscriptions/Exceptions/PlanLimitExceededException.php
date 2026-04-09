<?php

namespace App\Domain\Subscriptions\Exceptions;

use RuntimeException;

class PlanLimitExceededException extends RuntimeException
{
    public function __construct(
        public readonly string $limitKey,
        public readonly int $current,
        public readonly int $max,
        public readonly string $requiredPlan,
        string $message = 'Your current plan limit has been reached.',
    ) {
        parent::__construct($message);
    }
}
