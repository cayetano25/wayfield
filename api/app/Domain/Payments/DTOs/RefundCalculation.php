<?php

namespace App\Domain\Payments\DTOs;

use App\Domain\Payments\Models\RefundPolicy;

readonly class RefundCalculation
{
    public function __construct(
        public int $eligibleAmountCents,
        public bool $isAutoEligible,
        public RefundPolicy $policyApplied,
        public string $reasonDescription,
    ) {}
}
