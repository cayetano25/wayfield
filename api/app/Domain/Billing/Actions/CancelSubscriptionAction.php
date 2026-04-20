<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\StripeService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Subscription;
use RuntimeException;

class CancelSubscriptionAction
{
    public function __construct(private readonly StripeService $stripe) {}

    public function execute(Subscription $subscription, int $actorUserId): void
    {
        if ($subscription->stripe_subscription_id) {
            $this->stripe->cancelSubscription($subscription->stripe_subscription_id);
        }

        $subscription->update([
            'cancel_at_period_end' => true,
            'canceled_at'          => now(),
        ]);

        AuditLogService::record([
            'organization_id' => $subscription->organization_id,
            'actor_user_id'   => $actorUserId,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'subscription_canceled',
            'metadata'        => [
                'plan_code'    => $subscription->plan_code,
                'period_end'   => $subscription->current_period_end?->toIso8601String(),
            ],
        ]);
    }
}
