<?php

namespace Database\Factories;

use App\Models\FeatureFlag;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FeatureFlag>
 */
class FeatureFlagFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'feature_key'     => 'reporting',
            'is_enabled'      => false,
            'source'          => 'plan',
        ];
    }

    public function enabled(): static
    {
        return $this->state(['is_enabled' => true]);
    }

    public function manualOverride(): static
    {
        return $this->state(['source' => 'manual_override']);
    }

    public function forOrganization(int $organizationId): static
    {
        return $this->state(['organization_id' => $organizationId]);
    }

    public function forFeature(string $featureKey): static
    {
        return $this->state(['feature_key' => $featureKey]);
    }
}
