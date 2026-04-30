<?php

namespace App\Http\Resources;

use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Domain\Payments\Services\PriceResolutionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin WorkshopPriceTier */
class WorkshopPriceTierResource extends JsonResource
{
    private int $currentRegistrationCount = 0;

    public function withRegistrationCount(int $count): static
    {
        $this->currentRegistrationCount = $count;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'label'                 => $this->label,
            'price_cents'           => $this->price_cents,
            'price_formatted'       => $this->getFormattedPrice(),
            'valid_from'            => $this->valid_from?->toIso8601String(),
            'valid_until'           => $this->valid_until?->toIso8601String(),
            'capacity_limit'        => $this->capacity_limit,
            'registrations_at_tier' => $this->registrations_at_tier,
            'sort_order'            => $this->sort_order,
            'is_active'             => $this->is_active,
            'is_currently_active'   => $this->isEligible(now(), $this->currentRegistrationCount),
            'remaining_capacity'    => $this->getRemainingCapacity($this->currentRegistrationCount),
        ];
    }
}
