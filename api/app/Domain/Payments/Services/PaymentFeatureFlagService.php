<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Domain\Payments\Models\StripeConnectAccount;
use Illuminate\Support\Facades\Cache;

class PaymentFeatureFlagService
{
    private const PLATFORM_CACHE_TTL = 60;

    private const CREATOR_PLANS = ['creator', 'studio', 'custom'];

    public function isPaymentsEnabled(): bool
    {
        return Cache::remember('payment_flag.platform.payments_enabled', self::PLATFORM_CACHE_TTL, function () {
            return PaymentFeatureFlag::query()
                ->where('scope', 'platform')
                ->where('flag_key', 'payments_enabled')
                ->where('is_enabled', true)
                ->exists();
        });
    }

    public function isOrgPaymentsEnabled(int $orgId): bool
    {
        if (! $this->isPaymentsEnabled()) {
            return false;
        }

        return PaymentFeatureFlag::query()
            ->where('scope', 'organization')
            ->where('organization_id', $orgId)
            ->where('flag_key', 'org_payments_enabled')
            ->where('is_enabled', true)
            ->exists();
    }

    public function isDepositsEnabled(int $orgId): bool
    {
        if (! $this->isOrgPaymentsEnabled($orgId)) {
            return false;
        }

        $planCode = \App\Models\Organization::query()
            ->find($orgId)
            ?->activeSubscription
            ?->plan_code;

        if (! in_array($planCode, self::CREATOR_PLANS, true)) {
            return false;
        }

        return PaymentFeatureFlag::query()
            ->where('scope', 'organization')
            ->where('organization_id', $orgId)
            ->where('flag_key', 'deposits_enabled')
            ->where('is_enabled', true)
            ->exists();
    }

    public function canOrgAcceptPayments(int $orgId): bool
    {
        if (! $this->isOrgPaymentsEnabled($orgId)) {
            return false;
        }

        return StripeConnectAccount::query()
            ->where('organization_id', $orgId)
            ->where('charges_enabled', true)
            ->exists();
    }
}
