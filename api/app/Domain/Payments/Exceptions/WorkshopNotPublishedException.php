<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class WorkshopNotPublishedException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('This workshop is not available for registration.');
    }
}
