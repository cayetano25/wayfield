<?php

namespace App\Domain\Notifications\Exceptions;

use RuntimeException;

class LeaderMessagingScopeException extends RuntimeException
{
    public function __construct(string $message = 'Leader is not authorized to message participants of this session.')
    {
        parent::__construct($message);
    }
}
