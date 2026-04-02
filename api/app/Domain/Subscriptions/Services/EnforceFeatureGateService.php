<?php

namespace App\Domain\Subscriptions\Services;

use App\Domain\Subscriptions\Exceptions\FeatureNotAvailableException;
use App\Domain\Subscriptions\Exceptions\PlanLimitExceededException;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Workshop;

class EnforceFeatureGateService
{
    public function __construct(
        private readonly ResolveOrganizationEntitlementsService $entitlementsService,
    ) {}

    /**
     * Check if a feature is enabled for the organization.
     * Returns true/false — does NOT throw.
     */
    public function isFeatureEnabled(Organization $organization, string $featureKey): bool
    {
        $entitlements = $this->entitlementsService->resolve($organization);

        return $entitlements['features'][$featureKey] ?? false;
    }

    /**
     * Return the minimum plan required to access a feature.
     */
    public function requiredPlanFor(string $featureKey): string
    {
        return ResolveOrganizationEntitlementsService::FEATURE_REQUIRED_PLAN[$featureKey] ?? 'starter';
    }

    /**
     * Assert a feature is enabled — throws FeatureNotAvailableException if not.
     */
    public function assertFeatureEnabled(Organization $organization, string $featureKey): void
    {
        if (! $this->isFeatureEnabled($organization, $featureKey)) {
            throw new FeatureNotAvailableException(
                featureKey: $featureKey,
                requiredPlan: $this->requiredPlanFor($featureKey),
            );
        }
    }

    /**
     * Assert the organization can create another active workshop.
     * "Active" means status IN ('draft', 'published').
     *
     * @throws PlanLimitExceededException
     */
    public function assertCanCreateWorkshop(Organization $organization): void
    {
        $entitlements = $this->entitlementsService->resolve($organization);
        $max          = $entitlements['limits']['max_active_workshops'];

        if ($max === null) {
            return; // unlimited
        }

        $current = $entitlements['usage']['active_workshop_count'];

        if ($current >= $max) {
            throw new PlanLimitExceededException(
                limitKey: 'max_active_workshops',
                current: $current,
                max: $max,
                requiredPlan: $this->nextPlanUp($entitlements['plan']),
            );
        }
    }

    /**
     * Assert the workshop can accept another participant registration.
     *
     * @throws PlanLimitExceededException
     */
    public function assertCanAddParticipant(Organization $organization, Workshop $workshop): void
    {
        $entitlements = $this->entitlementsService->resolve($organization);
        $max          = $entitlements['limits']['max_participants_per_workshop'];

        if ($max === null) {
            return; // unlimited
        }

        $current = Registration::where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->count();

        if ($current >= $max) {
            throw new PlanLimitExceededException(
                limitKey: 'max_participants_per_workshop',
                current: $current,
                max: $max,
                requiredPlan: $this->nextPlanUp($entitlements['plan']),
            );
        }
    }

    /**
     * Assert the organization can add another manager (organization_users row).
     *
     * @throws PlanLimitExceededException
     */
    public function assertCanAddManager(Organization $organization): void
    {
        $entitlements = $this->entitlementsService->resolve($organization);
        $max          = $entitlements['limits']['max_managers'];

        if ($max === null) {
            return; // unlimited
        }

        $current = $entitlements['usage']['active_manager_count'];

        if ($current >= $max) {
            throw new PlanLimitExceededException(
                limitKey: 'max_managers',
                current: $current,
                max: $max,
                requiredPlan: $this->nextPlanUp($entitlements['plan']),
            );
        }
    }

    private function nextPlanUp(string $currentPlan): string
    {
        return match ($currentPlan) {
            'free'    => 'starter',
            'starter' => 'pro',
            default   => 'enterprise',
        };
    }
}
