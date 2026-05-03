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

    // ─────────────────────────────────────────────────────────────────────────
    // Config-driven methods (read exclusively from config/plans.php)
    // These use the new config key names (e.g. 'active_workshops', 'custom_branding').
    // Used by BillingController, PlansController, and new feature checks.
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns true if the organization's plan includes the given feature.
     * Reads from config/plans.features.{planCode}.{featureKey}.
     *
     * @param  string  $featureKey  A key from config('plans.features.*'), e.g. 'custom_branding'
     */
    public function hasFeature(Organization $org, string $featureKey): bool
    {
        $planCode = $org->subscription?->plan_code ?? 'foundation';
        $features = config("plans.features.{$planCode}", []);

        return (bool) ($features[$featureKey] ?? false);
    }

    /**
     * Returns the limit value for the given dimension on the org's plan.
     * Returns null if the plan has no limit for this dimension (unlimited).
     *
     * @param  string  $limitKey  A key from config('plans.limits.*'), e.g. 'active_workshops'
     */
    public function getLimit(Organization $org, string $limitKey): ?int
    {
        $planCode = $org->subscription?->plan_code ?? 'foundation';
        $limits = config("plans.limits.{$planCode}", []);

        return $limits[$limitKey] ?? null;
    }

    /**
     * Returns true if the org is within the given limit.
     * Always returns true when the limit is null (unlimited).
     *
     * @param  string  $limitKey  e.g. 'active_workshops', 'participants_per_workshop'
     * @param  int  $currentCount  Current usage count
     */
    public function isWithinLimit(Organization $org, string $limitKey, int $currentCount): bool
    {
        $limit = $this->getLimit($org, $limitKey);
        if ($limit === null) {
            return true; // unlimited
        }

        return $currentCount < $limit;
    }

    /**
     * Returns the display name for the org's current plan from config.
     * e.g. 'creator' → 'Creator'
     */
    public function getPlanDisplayName(Organization $org): string
    {
        $planCode = $org->subscription?->plan_code ?? 'foundation';

        return config("plans.display_names.{$planCode}", ucfirst($planCode));
    }

    /**
     * Returns true if the given plan code is higher than the org's current plan.
     * Used by upgrade prompts to determine which plans to offer.
     */
    public function isUpgrade(Organization $org, string $targetPlanCode): bool
    {
        $order = config('plans.order', []);
        $currentCode = $org->subscription?->plan_code ?? 'foundation';
        $currentIdx = array_search($currentCode, $order, true);
        $targetIdx = array_search($targetPlanCode, $order, true);

        if ($currentIdx === false || $targetIdx === false) {
            return false;
        }

        return $targetIdx > $currentIdx;
    }

    /**
     * Builds the standardised plan_limit_reached error array.
     * Used by controllers when catching PlanLimitExceededException.
     *
     * @param  string  $configLimitKey  The config/plans.php limit key, e.g. 'active_workshops'
     */
    public function planLimitErrorArray(
        Organization $org,
        PlanLimitExceededException $e,
        string $configLimitKey,
    ): array {
        $planCode = $org->subscription?->plan_code ?? 'foundation';
        $displayName = config("plans.display_names.{$planCode}", ucfirst($planCode));
        $nextPlan = $this->nextPlanUp($planCode);
        $limit = $e->max;
        $label = str_replace('_', ' ', $configLimitKey);

        return [
            'error' => 'plan_limit_reached',
            'limit_key' => $configLimitKey,
            'current_count' => $e->current,
            'limit' => $limit,
            'current_plan' => $planCode,
            'current_plan_display' => $displayName,
            'upgrade_to' => $nextPlan,
            'upgrade_to_display' => $nextPlan ? config("plans.display_names.{$nextPlan}") : null,
            'upgrade_url' => '/admin/organization/billing',
            'message' => "You've reached the {$displayName} plan limit of {$limit} {$label}.",
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Legacy assertion methods (delegate to ResolveOrganizationEntitlementsService)
    // These use the legacy feature key names consumed by GET /entitlements.
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check if a feature is enabled for the organization.
     * Uses legacy feature keys from the entitlements resolver.
     * Returns true/false — does NOT throw.
     */
    public function isFeatureEnabled(Organization $organization, string $featureKey): bool
    {
        $entitlements = $this->entitlementsService->resolve($organization);

        return $entitlements['features'][$featureKey] ?? false;
    }

    /**
     * Return the minimum plan required to access a feature (legacy feature keys).
     */
    public function requiredPlanFor(string $featureKey): string
    {
        return ResolveOrganizationEntitlementsService::FEATURE_REQUIRED_PLAN[$featureKey] ?? 'creator';
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
        $max = $entitlements['limits']['max_active_workshops'];

        if ($max === null) {
            return; // unlimited
        }

        $current = $entitlements['usage']['active_workshop_count'];

        if ($current >= $max) {
            throw new PlanLimitExceededException(
                limitKey: 'active_workshops',
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
        $max = $entitlements['limits']['max_participants_per_workshop'];

        if ($max === null) {
            return; // unlimited
        }

        $current = Registration::where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->count();

        if ($current >= $max) {
            throw new PlanLimitExceededException(
                limitKey: 'participants_per_workshop',
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
        $max = $entitlements['limits']['max_managers'];

        if ($max === null) {
            return; // unlimited
        }

        $current = $entitlements['usage']['active_manager_count'];

        if ($current >= $max) {
            throw new PlanLimitExceededException(
                limitKey: 'organizers',
                current: $current,
                max: $max,
                requiredPlan: $this->nextPlanUp($entitlements['plan']),
            );
        }
    }

    private function nextPlanUp(string $currentPlan): string
    {
        $order = config('plans.order', ['foundation', 'creator', 'studio', 'enterprise']);
        $idx = array_search($currentPlan, $order, true);

        return ($idx !== false && isset($order[$idx + 1])) ? $order[$idx + 1] : 'enterprise';
    }
}
