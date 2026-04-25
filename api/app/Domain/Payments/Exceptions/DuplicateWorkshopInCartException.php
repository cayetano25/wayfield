<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class DuplicateWorkshopInCartException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('You are already registered for this workshop, or it is already in your cart.');
    }
}
