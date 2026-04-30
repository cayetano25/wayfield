<?php

namespace App\Domain\Payments\DTOs;

use App\Domain\Payments\Models\Coupon;

readonly class CouponValidationResult
{
    public function __construct(
        public readonly ?Coupon $coupon,
        public readonly int $applicableSubtotalCents,
        public readonly int $discountCents,
        public readonly int $discountedTotalCents,
        public readonly ?string $errorCode,
        public readonly ?string $errorMessage,
    ) {}

    public function isValid(): bool
    {
        return $this->errorCode === null;
    }

    public static function error(string $code, string $message): self
    {
        return new self(
            coupon: null,
            applicableSubtotalCents: 0,
            discountCents: 0,
            discountedTotalCents: 0,
            errorCode: $code,
            errorMessage: $message,
        );
    }
}
