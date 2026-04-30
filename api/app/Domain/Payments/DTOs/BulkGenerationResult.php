<?php

namespace App\Domain\Payments\DTOs;

readonly class BulkGenerationResult
{
    public function __construct(
        public int $count,
        public array $codes,
        public array $coupon_ids,
        public string $label,
        public int $failed,
    ) {}
}
