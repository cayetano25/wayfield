<?php

namespace App\Domain\Payments\DTOs;

use Carbon\Carbon;

class NextTierInfo
{
    public function __construct(
        public int $priceCents,
        public string $tierLabel,
        public ?Carbon $activatesAt,
        public ?int $activatesAtCapacity,
        public string $changeDirection,
    ) {}

    public function toArray(): array
    {
        return [
            'price_cents'           => $this->priceCents,
            'tier_label'            => $this->tierLabel,
            'activates_at'          => $this->activatesAt?->toIso8601String(),
            'activates_at_capacity' => $this->activatesAtCapacity,
            'change_direction'      => $this->changeDirection,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            priceCents:          $data['price_cents'],
            tierLabel:           $data['tier_label'],
            activatesAt:         isset($data['activates_at']) ? Carbon::parse($data['activates_at']) : null,
            activatesAtCapacity: $data['activates_at_capacity'],
            changeDirection:     $data['change_direction'],
        );
    }
}
