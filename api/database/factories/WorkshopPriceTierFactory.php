<?php

namespace Database\Factories;

use App\Domain\Payments\Models\WorkshopPriceTier;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkshopPriceTier>
 */
class WorkshopPriceTierFactory extends Factory
{
    protected $model = WorkshopPriceTier::class;

    public function definition(): array
    {
        return [
            'workshop_id'    => Workshop::factory(),
            'label'          => 'Early Bird',
            'price_cents'    => 15000,
            'valid_from'     => now()->subDay(),
            'valid_until'    => now()->addDays(30),
            'capacity_limit' => null,
            'sort_order'     => 0,
            'is_active'      => true,
        ];
    }

    public function earlyBird(int $priceCents = 15000, ?Carbon $until = null): static
    {
        return $this->state([
            'label'       => 'Early Bird',
            'price_cents' => $priceCents,
            'valid_from'  => now()->subDay(),
            'valid_until' => $until ?? now()->addDays(30),
            'is_active'   => true,
        ]);
    }

    public function standard(int $priceCents = 17500): static
    {
        return $this->state([
            'label'          => 'Standard',
            'price_cents'    => $priceCents,
            'valid_from'     => now()->subDay(),
            'valid_until'    => null,
            'capacity_limit' => 50,
            'is_active'      => true,
        ]);
    }

    public function expired(int $priceCents = 12000): static
    {
        return $this->state([
            'label'       => 'Super Early Bird',
            'price_cents' => $priceCents,
            'valid_from'  => now()->subDays(30),
            'valid_until' => now()->subDay(),
            'is_active'   => true,
        ]);
    }

    public function capacityBased(int $priceCents = 15000, int $limit = 10): static
    {
        return $this->state([
            'label'          => "First {$limit} seats",
            'price_cents'    => $priceCents,
            'valid_from'     => now()->subDay(),
            'valid_until'    => null,
            'capacity_limit' => $limit,
            'is_active'      => true,
        ]);
    }

    public function notYetActive(int $priceCents = 20000): static
    {
        return $this->state([
            'label'          => 'Late Registration',
            'price_cents'    => $priceCents,
            'valid_from'     => now()->addDays(30),
            'valid_until'    => null,
            'capacity_limit' => 20,
            'is_active'      => true,
        ]);
    }
}
