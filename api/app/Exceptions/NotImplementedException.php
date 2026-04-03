<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown by stub service methods that are schema-ready but not yet implemented.
 * Phase 9 scaffolding: SSO methods throw this until a future activation phase.
 */
class NotImplementedException extends RuntimeException
{
    public function __construct(string $message = 'This feature is not yet active.')
    {
        parent::__construct($message);
    }
}
