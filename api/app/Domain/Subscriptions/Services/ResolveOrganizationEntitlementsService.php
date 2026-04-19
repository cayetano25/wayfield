<?php

namespace App\Domain\Subscriptions\Services;

use App\Models\Organization;
use App\Models\Workshop;

/**
 * Resolves the full entitlements picture for an organization based on its active
 * subscription plan and any manual_override rows in feature_flags.
 *
 * Returns a structured array consumed by EnforceFeatureGateService and the
 * GET /entitlements endpoint.
 */
class ResolveOrganizationEntitlementsService
{
    /**
     * Map config/plans.php limit keys to the legacy keys returned by resolve().
     * The legacy keys are stable API surface consumed by GET /entitlements and
     * EnforceFeatureGateService::assertCan* methods.
     */
    private const LIMIT_KEY_MAP = [
        'active_workshops' => 'max_active_workshops',
        'participants_per_workshop' => 'max_participants_per_workshop',
        'organizers' => 'max_managers',
    ];

    /**
     * Plan-level feature availability (before manual overrides are applied).
     */
    private const PLAN_FEATURES = [
        'free' => [
            'analytics' => false,
            'reporting' => false,
            'automation' => false,
            'advanced_notifications' => false,
            'waitlists' => false,
            'branded_pages' => false,
            'leader_messaging' => false,
            'api_access' => false,
            'webhooks' => false,
            'segmentation' => false,
        ],
        'starter' => [
            'analytics' => true,
            'reporting' => true,
            'automation' => true,
            'advanced_notifications' => true,
            'waitlists' => true,
            'branded_pages' => true,
            'leader_messaging' => true,
            'api_access' => false,
            'webhooks' => false,
            'segmentation' => false,
        ],
        'pro' => [
            'analytics' => true,
            'reporting' => true,
            'automation' => true,
            'advanced_notifications' => true,
            'waitlists' => true,
            'branded_pages' => true,
            'leader_messaging' => true,
            'api_access' => true,
            'webhooks' => true,
            'segmentation' => true,
        ],
        'enterprise' => [
            'analytics' => true,
            'reporting' => true,
            'automation' => true,
            'advanced_notifications' => true,
            'waitlists' => true,
            'branded_pages' => true,
            'leader_messaging' => true,
            'api_access' => true,
            'webhooks' => true,
            'segmentation' => true,
        ],
    ];

    /**
     * The minimum plan required to access each feature.
     */
    public const FEATURE_REQUIRED_PLAN = [
        'analytics' => 'starter',
        'reporting' => 'starter',
        'automation' => 'starter',
        'advanced_notifications' => 'starter',
        'waitlists' => 'starter',
        'branded_pages' => 'starter',
        'leader_messaging' => 'starter',
        'api_access' => 'pro',
        'webhooks' => 'pro',
        'segmentation' => 'pro',
    ];

    /**
     * Resolve full entitlements for the given organization.
     *
     * @return array{
     *   plan: string,
     *   subscription_status: string,
     *   limits: array{max_active_workshops: int|null, max_participants_per_workshop: int|null, max_managers: int|null},
     *   features: array<string, bool>,
     *   usage: array{active_workshop_count: int, active_manager_count: int, active_leader_count: int},
     * }
     */
    public function resolve(Organization $organization): array
    {
        $subscription = $organization->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('starts_at')
            ->first();

        $planCode = $subscription?->plan_code ?? 'free';
        $subStatus = $subscription?->status ?? 'none';

        $limits = $this->resolveLimits($planCode);
        $features = self::PLAN_FEATURES[$planCode] ?? self::PLAN_FEATURES['free'];

        // Apply manual_override rows from feature_flags
        $overrides = $organization->featureFlags()
            ->where('source', 'manual_override')
            ->get()
            ->keyBy('feature_key');

        foreach ($overrides as $key => $flag) {
            $features[$key] = $flag->is_enabled;
        }

        $usage = $this->computeUsage($organization);

        return [
            'plan' => $planCode,
            'subscription_status' => $subStatus,
            'limits' => $limits,
            'features' => $features,
            'usage' => $usage,
        ];
    }

    /**
     * Compute current usage counters for the organization.
     *
     * @return array{active_workshop_count: int, active_manager_count: int, active_leader_count: int}
     */
    public function computeUsage(Organization $organization): array
    {
        $activeWorkshopCount = Workshop::where('organization_id', $organization->id)
            ->whereIn('status', ['draft', 'published'])
            ->count();

        $activeManagerCount = $organization->organizationUsers()
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin', 'staff', 'billing_admin'])
            ->count();

        $activeLeaderCount = $organization->organizationLeaders()->count();

        return [
            'active_workshop_count' => $activeWorkshopCount,
            'active_manager_count' => $activeManagerCount,
            'active_leader_count' => $activeLeaderCount,
        ];
    }

    /**
     * Resolve plan limits from config/plans.php, mapped to legacy key names.
     * Legacy keys are stable API surface; config keys are the source of truth.
     */
    private function resolveLimits(string $planCode): array
    {
        $configLimits = config("plans.limits.{$planCode}", config('plans.limits.free', []));
        $mapped = [];
        foreach (self::LIMIT_KEY_MAP as $configKey => $legacyKey) {
            $mapped[$legacyKey] = $configLimits[$configKey] ?? null;
        }

        return $mapped;
    }

    /**
     * Return plan limits for external use (reads from config).
     */
    public static function planLimits(string $planCode): array
    {
        $configLimits = config("plans.limits.{$planCode}", config('plans.limits.free', []));
        $mapped = [];
        foreach (self::LIMIT_KEY_MAP as $configKey => $legacyKey) {
            $mapped[$legacyKey] = $configLimits[$configKey] ?? null;
        }

        return $mapped;
    }
}
