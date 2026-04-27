<?php

namespace App\Domain\Payments\DTOs;

readonly class FeeBreakdown
{
    public function __construct(
        public int $amountCents,
        public int $wayFieldFeeCents,
        public int $stripeFeeCents,
        public int $totalFeeCents,
        public int $organizerPayoutCents,
        public float $takeRatePct,
        public string $currency,
    ) {}
}
