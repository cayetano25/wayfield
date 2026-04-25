<?php

namespace App\Domain\Payments\DTOs;

use App\Domain\Payments\Models\Order;

readonly class CheckoutResult
{
    public function __construct(
        public Order $order,
        public bool $requiresPayment,
        public ?string $clientSecret = null,
        public ?string $stripePublishableKey = null,
    ) {}
}
