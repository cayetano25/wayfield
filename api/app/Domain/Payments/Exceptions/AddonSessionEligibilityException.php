<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class AddonSessionEligibilityException extends RuntimeException
{
    public function __construct(string $reason)
    {
        parent::__construct($reason);
    }
}
