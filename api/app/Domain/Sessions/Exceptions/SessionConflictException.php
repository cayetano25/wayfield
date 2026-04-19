<?php

namespace App\Domain\Sessions\Exceptions;

use RuntimeException;

class SessionConflictException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly ?int $conflictingSessionId = null,
        private readonly ?string $conflictingSessionTitle = null,
        private readonly ?string $conflictingSessionStartAt = null,
        private readonly ?string $conflictingSessionEndAt = null,
    ) {
        parent::__construct($message);
    }

    public function getConflictingSessionId(): ?int
    {
        return $this->conflictingSessionId;
    }

    public function getConflictingSessionTitle(): ?string
    {
        return $this->conflictingSessionTitle;
    }

    public function getConflictingSessionStartAt(): ?string
    {
        return $this->conflictingSessionStartAt;
    }

    public function getConflictingSessionEndAt(): ?string
    {
        return $this->conflictingSessionEndAt;
    }
}
