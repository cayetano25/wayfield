<?php

namespace App\Domain\Sessions\Actions;

use App\Models\SessionSelection;

/**
 * Value object returned by AssignParticipantToSessionAction::assign().
 */
class AssignParticipantResult
{
    public function __construct(
        public readonly bool $success,
        public readonly SessionSelection $sessionSelection,
        /** @var array<int, array{code: string, message: string}> */
        public readonly array $warnings = [],
    ) {}

    public function hasWarnings(): bool
    {
        return ! empty($this->warnings);
    }
}
