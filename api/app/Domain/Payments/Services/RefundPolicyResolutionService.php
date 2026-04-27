<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\DTOs\RefundCalculation;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\RefundPolicy;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Workshop;
use Carbon\Carbon;

class RefundPolicyResolutionService
{
    /**
     * Resolve the effective refund policy for a workshop.
     * Workshop-level policy wins; falls back to org-level; then platform defaults.
     */
    public function resolve(Workshop $workshop): RefundPolicy
    {
        // 1. Workshop-level policy
        $workshopPolicy = RefundPolicy::query()
            ->where('scope', 'workshop')
            ->where('workshop_id', $workshop->id)
            ->first();

        if ($workshopPolicy !== null) {
            return $workshopPolicy;
        }

        // 2. Org-level policy
        $orgPolicy = RefundPolicy::query()
            ->where('scope', 'organization')
            ->where('organization_id', $workshop->organization_id)
            ->first();

        if ($orgPolicy !== null) {
            return $orgPolicy;
        }

        // 3. Platform default (unseeded, ephemeral model — not persisted)
        return $this->platformDefault();
    }

    /**
     * Determine if an order is auto-eligible for refund under the resolved policy.
     * Returns false if commitment date has passed, deposit is nonrefundable, or
     * the event is outside the full-refund window.
     */
    public function isAutoEligible(Order $order, Workshop $workshop): bool
    {
        $policy = $this->resolve($workshop);

        // Commitment date passed → organizer may not auto-approve
        $workshopPricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        if ($workshopPricing?->commitment_date && now()->gt($workshopPricing->commitment_date)) {
            return false;
        }

        // Deposit order where the deposit itself is nonrefundable
        if ($order->is_deposit_order && $order->isDepositOnly()) {
            if ($workshopPricing?->deposit_is_nonrefundable) {
                return false;
            }
        }

        $daysUntilStart = max(0, now()->diffInDays(
            Carbon::parse($workshop->start_date)->startOfDay(),
            false,
        ));

        return $daysUntilStart >= $policy->full_refund_cutoff_days;
    }

    /**
     * Calculate the refundable amount for an order under the resolved policy.
     */
    public function calculateRefundAmount(Order $order, Workshop $workshop): RefundCalculation
    {
        $policy = $this->resolve($workshop);

        $workshopPricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        // Commitment date check
        if ($workshopPricing?->commitment_date && now()->gt($workshopPricing->commitment_date)) {
            return new RefundCalculation(
                eligibleAmountCents: 0,
                isAutoEligible: false,
                policyApplied: $policy,
                reasonDescription: 'Commitment date has passed; refund requires manual review.',
            );
        }

        $refundableBase = $this->computeRefundableBase($order, $workshopPricing, $policy);

        if ($refundableBase === 0) {
            return new RefundCalculation(
                eligibleAmountCents: 0,
                isAutoEligible: false,
                policyApplied: $policy,
                reasonDescription: 'No refundable amount for this order.',
            );
        }

        $now = now();
        $startDate = Carbon::parse($workshop->start_date)->startOfDay();
        $hoursUntilStart = max(0, (int) $now->diffInHours($startDate, false));
        $daysUntilStart  = max(0, (int) $now->diffInDays($startDate, false));

        if ($hoursUntilStart <= $policy->no_refund_cutoff_hours) {
            return new RefundCalculation(
                eligibleAmountCents: 0,
                isAutoEligible: false,
                policyApplied: $policy,
                reasonDescription: "Within no-refund window ({$policy->no_refund_cutoff_hours}h before start).",
            );
        }

        if ($daysUntilStart >= $policy->full_refund_cutoff_days) {
            return new RefundCalculation(
                eligibleAmountCents: $refundableBase,
                isAutoEligible: true,
                policyApplied: $policy,
                reasonDescription: "Full refund eligible — cancelled {$daysUntilStart} days before start.",
            );
        }

        if ($daysUntilStart >= $policy->partial_refund_cutoff_days) {
            $partial = (int) floor($refundableBase * ($policy->partial_refund_pct / 100));

            return new RefundCalculation(
                eligibleAmountCents: $partial,
                isAutoEligible: false,
                policyApplied: $policy,
                reasonDescription: "Partial refund ({$policy->partial_refund_pct}%) — cancelled {$daysUntilStart} days before start.",
            );
        }

        return new RefundCalculation(
            eligibleAmountCents: 0,
            isAutoEligible: false,
            policyApplied: $policy,
            reasonDescription: 'Past partial refund cutoff; no refund eligible.',
        );
    }

    // ─────────────────────────────────────────────────────────────────────────

    private function computeRefundableBase(
        Order $order,
        ?WorkshopPricing $pricing,
        RefundPolicy $policy,
    ): int {
        // Deposit-only paid and deposit is nonrefundable → nothing to refund
        if ($order->is_deposit_order && $order->isDepositOnly()) {
            if ($pricing?->deposit_is_nonrefundable) {
                return 0;
            }
        }

        $base = $order->total_cents;

        if (! $policy->wayfield_fee_refundable) {
            $base -= $order->wayfield_fee_cents;
            // Stripe fees are passed through; never returned to customer
            $base -= $order->stripe_fee_cents;
        }

        return max(0, $base);
    }

    /**
     * Hardcoded platform-level default policy (not persisted).
     * Used only when neither workshop nor org has a custom policy.
     */
    private function platformDefault(): RefundPolicy
    {
        $policy = new RefundPolicy();
        $policy->scope                    = 'organization'; // treat as org-level semantically
        $policy->full_refund_cutoff_days  = 30;
        $policy->partial_refund_cutoff_days = 14;
        $policy->partial_refund_pct       = 50.0;
        $policy->no_refund_cutoff_hours   = 48;
        $policy->wayfield_fee_refundable  = false;
        $policy->stripe_fee_refundable    = false;
        $policy->allow_credits            = false;
        $policy->credit_expiry_days       = null;
        $policy->custom_policy_text       = null;

        return $policy;
    }
}
