<?php

namespace App\Domain\Attendance\Exceptions;

use RuntimeException;

class AttendanceEligibilityException extends RuntimeException
{
    public function __construct(string $message = 'You are not eligible to check in to this session.')
    {
        parent::__construct($message);
    }
}
