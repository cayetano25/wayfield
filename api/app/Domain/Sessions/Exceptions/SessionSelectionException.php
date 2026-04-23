<?php

namespace App\Domain\Sessions\Exceptions;

use RuntimeException;

/**
 * Thrown when a session selection attempt fails a gate condition.
 * The error_code maps to a specific HTTP error code in the controller.
 */
class SessionSelectionException extends RuntimeException
{
    public const SESSION_NOT_PUBLISHED = 'SESSION_NOT_PUBLISHED';

    public const SESSION_NOT_VISIBLE_FOR_SELECTION = 'SESSION_NOT_VISIBLE_FOR_SELECTION';

    public const SESSION_NOT_SELF_SELECTABLE = 'SESSION_NOT_SELF_SELECTABLE';

    public const SESSION_AT_CAPACITY = 'SESSION_AT_CAPACITY';

    public const SCHEDULE_CONFLICT = 'SCHEDULE_CONFLICT';

    public const SESSION_SELECTION_WINDOW_CLOSED = 'SESSION_SELECTION_WINDOW_CLOSED';

    public function __construct(
        private readonly string $errorCode,
        string $message = '',
        private readonly array $context = [],
    ) {
        parent::__construct($message ?: $errorCode);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }

    public function getContext(): array
    {
        return $this->context;
    }
}
