<?php

namespace App\Domain\Notifications\Exceptions;

use RuntimeException;

class LeaderMessagingWindowException extends RuntimeException
{
    public function __construct(string $message = 'Leader messaging is only allowed within the approved time window around the session.')
    {
        parent::__construct($message);
    }
}
