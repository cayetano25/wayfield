<?php

namespace App\Domain\Notifications\Exceptions;

use RuntimeException;

/**
 * Thrown when delivery_scope = 'custom' is requested.
 *
 * 'custom' delivery scope is reserved for future implementation.
 * See README.md Open Issues — no data model exists for this yet.
 */
class CustomDeliveryNotImplementedException extends RuntimeException
{
}
