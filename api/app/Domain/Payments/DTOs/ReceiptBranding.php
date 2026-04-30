<?php

namespace App\Domain\Payments\DTOs;

readonly class ReceiptBranding
{
    public function __construct(
        public ?string $logoUrl,
        public string  $orgName,
        public ?string $orgEmail,
        public ?string $orgPhone,
        public string  $primaryColor,
        public bool    $showWayfieldBrand,
        public bool    $showOrgLogo,
    ) {}
}
