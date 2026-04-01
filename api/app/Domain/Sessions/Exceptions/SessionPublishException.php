<?php

namespace App\Domain\Sessions\Exceptions;

use RuntimeException;

class SessionPublishException extends RuntimeException
{
    /** @var array<string, array<string>> */
    private array $errors;

    /** @param array<string, array<string>> $errors */
    public function __construct(array $errors)
    {
        parent::__construct('Session cannot be published.');
        $this->errors = $errors;
    }

    /** @return array<string, array<string>> */
    public function getErrors(): array
    {
        return $this->errors;
    }
}
