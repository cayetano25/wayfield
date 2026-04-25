<?php

namespace App\Domain\Payments\Exceptions;

use RuntimeException;

class StripeConnectNotReadyException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct(
            'This organization has not completed Stripe Connect onboarding. '
            . 'Paid checkout is not available.'
        );
    }
}
