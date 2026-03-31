<?php

namespace App\Domain\Workshops\Exceptions;

use RuntimeException;

class WorkshopPublishException extends RuntimeException
{
    /** @var array<string, array<string>> */
    private array $errors;

    /** @param array<string, array<string>> $errors */
    public function __construct(array $errors)
    {
        $this->errors = $errors;
        parent::__construct('Workshop cannot be published.');
    }

    /** @return array<string, array<string>> */
    public function getErrors(): array
    {
        return $this->errors;
    }
}
