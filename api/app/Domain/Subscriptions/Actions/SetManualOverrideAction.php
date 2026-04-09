<?php

namespace App\Domain\Subscriptions\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\FeatureFlag;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class SetManualOverrideAction
{
    /**
     * Set a manual_override feature flag for the organization.
     *
     * Only users with role = 'owner' in the organization may call this.
     * Always writes an audit_logs record.
     *
     * @throws AuthorizationException
     */
    public function execute(
        Organization $organization,
        User $actor,
        string $featureKey,
        bool $isEnabled,
    ): FeatureFlag {
        $isOwner = $organization->organizationUsers()
            ->where('user_id', $actor->id)
            ->where('is_active', true)
            ->where('role', 'owner')
            ->exists();

        if (! $isOwner) {
            throw new AuthorizationException(
                'Only the organization owner may set manual feature flag overrides.'
            );
        }

        // Capture previous value for audit metadata
        $existing = FeatureFlag::where('organization_id', $organization->id)
            ->where('feature_key', $featureKey)
            ->first();
        $previousValue = $existing?->is_enabled;

        $flag = FeatureFlag::updateOrCreate(
            [
                'organization_id' => $organization->id,
                'feature_key' => $featureKey,
            ],
            [
                'is_enabled' => $isEnabled,
                'source' => 'manual_override',
            ]
        );

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'feature_flag',
            'entity_id' => $flag->id,
            'action' => 'manual_override_set',
            'metadata' => [
                'feature_key' => $featureKey,
                'is_enabled' => $isEnabled,
                'organization_id' => $organization->id,
                'previous_value' => $previousValue,
            ],
        ]);

        return $flag;
    }
}
