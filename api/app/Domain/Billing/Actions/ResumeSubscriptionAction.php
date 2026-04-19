<?php

namespace App\Domain\Billing\Actions;

use App\Domain\Billing\Services\StripeService;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Subscription;
use RuntimeException;

class ResumeSubscriptionAction
{
    public function __construct(private readonly StripeService $stripe) {}

    public function execute(Subscription $subscription, int $actorUserId): void
    {
        if (!$subscription->stripe_subscription_id) {
            throw new RuntimeException('Subscription has no Stripe subscription ID.');
        }

        $this->stripe->resumeSubscription($subscription->stripe_subscription_id);

        $subscription->update([
            'cancel_at_period_end' => false,
            'canceled_at'          => null,
        ]);

        AuditLogService::record([
            'organization_id' => $subscription->organization_id,
            'actor_user_id'   => $actorUserId,
            'entity_type'     => 'subscription',
            'entity_id'       => $subscription->id,
            'action'          => 'subscription_resumed',
            'metadata'        => [
                'plan_code' => $subscription->plan_code,
            ],
        ]);
    }
}
