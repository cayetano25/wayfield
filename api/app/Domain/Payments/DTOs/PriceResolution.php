<?php

namespace App\Domain\Payments\DTOs;

class PriceResolution
{
    public function __construct(
        public int $priceCents,
        public string $currency,
        public ?int $tierId,
        public ?string $tierLabel,
        public bool $isTierPrice,
        public ?int $remainingCapacity,
        public ?NextTierInfo $nextTier,
        public int $basePriceCents,
    ) {}

    public function toArray(): array
    {
        return [
            'price_cents'        => $this->priceCents,
            'currency'           => $this->currency,
            'tier_id'            => $this->tierId,
            'tier_label'         => $this->tierLabel,
            'is_tier_price'      => $this->isTierPrice,
            'remaining_capacity' => $this->remainingCapacity,
            'next_tier'          => $this->nextTier?->toArray(),
            'base_price_cents'   => $this->basePriceCents,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            priceCents:        $data['price_cents'],
            currency:          $data['currency'],
            tierId:            $data['tier_id'],
            tierLabel:         $data['tier_label'],
            isTierPrice:       $data['is_tier_price'],
            remainingCapacity: $data['remaining_capacity'],
            nextTier:          isset($data['next_tier']) ? NextTierInfo::fromArray($data['next_tier']) : null,
            basePriceCents:    $data['base_price_cents'],
        );
    }
}
