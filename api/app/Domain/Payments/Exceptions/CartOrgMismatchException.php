<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class CartOrgMismatchException extends RuntimeException
{
    public function __construct(
        public readonly int $existingOrgId,
        public readonly string $existingOrgName,
    ) {
        parent::__construct(
            "An active cart already exists for organization '{$existingOrgName}'. "
            . 'Complete or abandon it before adding items from a different organization.'
        );
    }
}
