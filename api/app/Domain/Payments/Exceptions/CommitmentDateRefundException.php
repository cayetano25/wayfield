<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class CommitmentDateRefundException extends RuntimeException
{
    public function __construct(string $message = 'Refund not allowed after the commitment date.')
    {
        parent::__construct($message);
    }
}
