<?php

namespace App\Exceptions;

use RuntimeException;

class LeaderMessagingDeniedException extends RuntimeException
{
    private string $errorCode;

    private array $extra;

    public function __construct(string $errorCode, string $message, array $extra = [])
    {
        parent::__construct($message);
        $this->errorCode = $errorCode;
        $this->extra = $extra;
    }

    public static function planRequired(): self
    {
        return new self(
            'plan_required',
            'Leader notifications require a Starter plan or higher.',
            ['required_plan' => 'starter'],
        );
    }

    public static function notAssigned(string $message = 'You are not assigned to this session and cannot message its participants.'): self
    {
        return new self('messaging_denied', $message);
    }

    public static function outsideWindow(string $message): self
    {
        return new self('messaging_window', $message);
    }

    public function getResponseData(): array
    {
        return array_merge(['error' => $this->errorCode, 'message' => $this->getMessage()], $this->extra);
    }

    public function getErrorCode(): string
    {
        return $this->errorCode;
    }
}
