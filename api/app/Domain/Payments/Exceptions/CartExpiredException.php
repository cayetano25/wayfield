<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class CartExpiredException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Your cart has expired. Please start a new cart.');
    }
}
