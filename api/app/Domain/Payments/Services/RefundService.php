<?php

declare(strict_types=1);

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Exceptions\CommitmentDateRefundException;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\OrderItem;
use App\Domain\Payments\Models\PlatformCredit;
use App\Domain\Payments\Models\RefundRequest;
use App\Domain\Payments\Models\RefundTransaction;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Shared\Services\AuditLogService;
use App\Jobs\Payments\ProcessRefundApprovedJob;
use App\Jobs\Payments\ProcessRefundDeniedJob;
use App\Jobs\Payments\ProcessRefundRequestedJob;
use App\Models\Notification;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Stripe\StripeClient;

class RefundService
{
    private StripeClient $stripe;

    public function __construct(
        private readonly RefundPolicyResolutionService $policyService,
    ) {
        $this->stripe = new StripeClient(config('stripe.secret_key'));
    }

    /**
     * Request a refund for a completed order.
     *
     * Step 1: validate eligibility
     * Step 2: check commitment date enforcement
     * Step 3: resolve policy and auto-eligibility
     * Step 4: persist RefundRequest
     * Step 5: auto-approve if eligible
     */
    public function requestRefund(
        Order $order,
        User $requestedBy,
        string $reasonCode,
        ?string $reasonText,
        int $requestedAmountCents,
        ?int $orderItemId = null,
    ): RefundRequest {
        // Step 1 — validate
        if ($order->user_id !== $requestedBy->id) {
            throw new \InvalidArgumentException('You can only request refunds for your own orders.');
        }

        if (! in_array($order->status, ['completed', 'partially_refunded'], true)) {
            throw new \InvalidArgumentException('Refunds can only be requested for completed orders.');
        }

        $pendingExists = RefundRequest::query()
            ->where('order_id', $order->id)
            ->where('status', 'pending')
            ->exists();

        if ($pendingExists) {
            throw new \InvalidArgumentException('A refund request for this order is already pending.');
        }

        $alreadyRefundedCents = $this->resolveAlreadyRefundedCents($order);

        if ($requestedAmountCents > ($order->total_cents - $alreadyRefundedCents)) {
            throw new \InvalidArgumentException('Requested amount exceeds the refundable balance.');
        }

        // Step 2 — commitment date check
        $workshop = $this->resolveWorkshop($order);

        if ($workshop !== null) {
            $workshopPricing = WorkshopPricing::query()
                ->where('workshop_id', $workshop->id)
                ->first();

            if ($workshopPricing?->commitment_date && now()->gt($workshopPricing->commitment_date)) {
                $postPct = $workshopPricing->post_commitment_refund_pct ?? 0.0;

                if ($postPct <= 0) {
                    // Notify participant that no refund is available
                    Notification::create([
                        'organization_id'   => $order->organization_id,
                        'sent_by_user_id'   => null,
                        'workshop_id'       => $workshop->id,
                        'notification_type' => 'urgent',
                        'delivery_scope'    => 'all_participants',
                        'title'             => 'Refund not available',
                        'body'              => 'The commitment date for this workshop has passed and no refunds are available. Please contact the organizer with any questions.',
                        'status'            => 'queued',
                    ]);

                    AuditLogService::record([
                        'organization_id' => $order->organization_id,
                        'actor_user_id'   => $requestedBy->id,
                        'entity_type'     => 'order',
                        'entity_id'       => $order->id,
                        'action'          => 'refund.rejected_commitment_date',
                        'metadata'        => [
                            'order_number'     => $order->order_number,
                            'commitment_date'  => $workshopPricing->commitment_date->toDateString(),
                        ],
                    ]);

                    throw new CommitmentDateRefundException;
                }

                // Partial post-commitment refund
                $requestedAmountCents = (int) floor($requestedAmountCents * ($postPct / 100));
            }
        }

        // Step 3 — resolve policy
        $refundCalculation = $workshop !== null
            ? $this->policyService->calculateRefundAmount($order, $workshop)
            : null;

        $autoEligible       = $refundCalculation?->isAutoEligible ?? false;
        $policyAppliedScope = $refundCalculation?->policyApplied?->scope ?? null;

        // Step 4 — create RefundRequest
        $refundRequest = DB::transaction(function () use (
            $order,
            $requestedBy,
            $reasonCode,
            $reasonText,
            $requestedAmountCents,
            $orderItemId,
            $autoEligible,
            $policyAppliedScope,
        ) {
            $refundRequest = RefundRequest::create([
                'order_id'               => $order->id,
                'order_item_id'          => $orderItemId,
                'requested_by_user_id'   => $requestedBy->id,
                'reason_code'            => $reasonCode,
                'reason_text'            => $reasonText,
                'requested_amount_cents' => $requestedAmountCents,
                'status'                 => 'pending',
                'auto_eligible'          => $autoEligible,
                'policy_applied_scope'   => $policyAppliedScope,
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => $requestedBy->id,
                'entity_type'     => 'refund_request',
                'entity_id'       => $refundRequest->id,
                'action'          => 'refund.requested',
                'metadata'        => [
                    'order_number'           => $order->order_number,
                    'requested_amount_cents' => $requestedAmountCents,
                    'reason_code'            => $reasonCode,
                    'auto_eligible'          => $autoEligible,
                ],
            ]);

            return $refundRequest;
        });

        // Queue N-26 in-app to participant (request received)
        Notification::create([
            'organization_id'   => $order->organization_id,
            'sent_by_user_id'   => null,
            'workshop_id'       => null,
            'notification_type' => 'informational',
            'delivery_scope'    => 'all_participants',
            'title'             => 'Refund request received',
            'body'              => "Your refund request for order {$order->order_number} has been received and is under review.",
            'status'            => 'queued',
        ]);

        // Queue N-27 email + in-app to organizer (action required)
        ProcessRefundRequestedJob::dispatch($refundRequest->id);

        // Step 5 — auto-approve if eligible
        if ($autoEligible) {
            $this->approveRefund($refundRequest, isAutomatic: true);
        }

        return $refundRequest->refresh();
    }

    /**
     * Approve a pending refund request and issue the Stripe refund.
     */
    public function approveRefund(
        RefundRequest $refundRequest,
        bool $isAutomatic = false,
        ?User $reviewedBy = null,
        ?int $approvedAmountCents = null,
        ?string $reviewNotes = null,
    ): RefundTransaction {
        $order = $refundRequest->order ?? $refundRequest->load('order')->order;

        $finalAmountCents = $approvedAmountCents ?? $refundRequest->requested_amount_cents;

        $newStatus = $isAutomatic ? 'auto_approved' : 'organizer_approved';

        $refundRequest->update([
            'status'                 => $newStatus,
            'approved_amount_cents'  => $finalAmountCents,
            'reviewed_by_user_id'    => $reviewedBy?->id,
            'reviewed_at'            => now(),
            'review_notes'           => $reviewNotes,
        ]);

        // Queue N-28 email to participant (approved — expect 3–5 business days)
        ProcessRefundApprovedJob::dispatch($refundRequest->id, $isAutomatic);

        // Call Stripe refund
        $connectAccount = StripeConnectAccount::query()
            ->where('organization_id', $order->organization_id)
            ->first();

        $stripeAccountId = $connectAccount?->stripe_account_id;

        $stripeRefund = $this->stripe->refunds->create([
            'charge'   => $order->stripe_charge_id,
            'amount'   => $finalAmountCents,
            'metadata' => [
                'refund_request_id' => $refundRequest->id,
                'order_number'      => $order->order_number,
                'reason_code'       => $refundRequest->reason_code,
            ],
        ], $stripeAccountId ? ['stripe_account' => $stripeAccountId] : []);

        // Create RefundTransaction
        $refundTransaction = RefundTransaction::create([
            'refund_request_id' => $refundRequest->id,
            'order_id'          => $order->id,
            'stripe_refund_id'  => $stripeRefund->id,
            'stripe_charge_id'  => $order->stripe_charge_id,
            'stripe_account_id' => $stripeAccountId ?? '',
            'amount_cents'      => $finalAmountCents,
            'currency'          => $order->currency ?? 'usd',
            'status'            => $stripeRefund->status,
            'stripe_created_at' => $stripeRefund->created
                ? \Carbon\Carbon::createFromTimestamp($stripeRefund->created)
                : null,
        ]);

        $refundRequest->update([
            'stripe_refund_id' => $stripeRefund->id,
            'processed_at'     => now(),
            'status'           => 'processed',
        ]);

        // Update order status
        $this->updateOrderRefundStatus($order, $finalAmountCents);

        // Update order item if applicable
        if ($refundRequest->order_item_id !== null) {
            $this->updateOrderItemRefundStatus($refundRequest->order_item_id, $finalAmountCents);
        }

        $auditAction = $isAutomatic ? 'refund.auto_approved' : 'refund.organizer_approved';

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'actor_user_id'   => $reviewedBy?->id,
            'entity_type'     => 'refund_request',
            'entity_id'       => $refundRequest->id,
            'action'          => $auditAction,
            'metadata'        => [
                'order_number'         => $order->order_number,
                'approved_amount_cents' => $finalAmountCents,
                'stripe_refund_id'     => $stripeRefund->id,
            ],
        ]);

        if ($isAutomatic) {
            // N-31 email to participant, N-32 in-app to organizer
            Notification::create([
                'organization_id'   => $order->organization_id,
                'sent_by_user_id'   => null,
                'workshop_id'       => null,
                'notification_type' => 'informational',
                'delivery_scope'    => 'all_participants',
                'title'             => 'Refund automatically processed',
                'body'              => "Your refund of $" . number_format($finalAmountCents / 100, 2)
                    . " for order {$order->order_number} has been automatically processed. "
                    . 'Funds typically arrive in 3–5 business days.',
                'status'            => 'queued',
            ]);
        }

        return $refundTransaction;
    }

    /**
     * Deny a pending refund request.
     */
    public function denyRefund(
        RefundRequest $refundRequest,
        User $reviewedBy,
        string $reviewNotes,
    ): void {
        $order = $refundRequest->order ?? $refundRequest->load('order')->order;

        $refundRequest->update([
            'status'             => 'organizer_denied',
            'reviewed_by_user_id' => $reviewedBy->id,
            'reviewed_at'        => now(),
            'review_notes'       => $reviewNotes,
        ]);

        // Queue N-30 email to participant (denied, include reason)
        ProcessRefundDeniedJob::dispatch($refundRequest->id);

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'actor_user_id'   => $reviewedBy->id,
            'entity_type'     => 'refund_request',
            'entity_id'       => $refundRequest->id,
            'action'          => 'refund.organizer_denied',
            'metadata'        => [
                'order_number' => $order->order_number,
                'review_notes' => $reviewNotes,
            ],
        ]);
    }

    /**
     * Handle charge.refund.updated webhook from Stripe.
     */
    public function handleRefundUpdated(array $stripeEvent): void
    {
        $refundData    = $stripeEvent['data']['object'] ?? [];
        $stripeRefundId = $refundData['id'] ?? null;

        if (! $stripeRefundId) {
            Log::warning('RefundService: charge.refund.updated missing refund id');
            return;
        }

        $refundTransaction = RefundTransaction::query()
            ->where('stripe_refund_id', $stripeRefundId)
            ->first();

        if (! $refundTransaction) {
            Log::warning('RefundService: RefundTransaction not found for stripe_refund_id', [
                'stripe_refund_id' => $stripeRefundId,
            ]);
            return;
        }

        $newStatus = $refundData['status'] ?? null;

        $refundTransaction->update(['status' => $newStatus]);

        $order         = $refundTransaction->order ?? $refundTransaction->load('order')->order;
        $refundRequest = $refundTransaction->refundRequest ?? $refundTransaction->load('refundRequest')->refundRequest;

        if ($newStatus === 'succeeded') {
            // N-29: money is on the way
            Notification::create([
                'organization_id'   => $order->organization_id,
                'sent_by_user_id'   => null,
                'workshop_id'       => null,
                'notification_type' => 'informational',
                'delivery_scope'    => 'all_participants',
                'title'             => 'Your refund is on the way',
                'body'              => 'Your refund of $' . number_format($refundTransaction->amount_cents / 100, 2)
                    . " for order {$order->order_number} has been processed by our payment provider. "
                    . 'Funds typically arrive in 3–5 business days.',
                'status'            => 'queued',
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'refund_transaction',
                'entity_id'       => $refundTransaction->id,
                'action'          => 'refund.stripe_processed',
                'metadata'        => [
                    'stripe_refund_id' => $stripeRefundId,
                    'amount_cents'     => $refundTransaction->amount_cents,
                    'order_number'     => $order->order_number,
                ],
            ]);
        } elseif ($newStatus === 'failed') {
            $failureReason = $refundData['failure_reason'] ?? 'Unknown failure reason';

            $refundTransaction->update(['failure_reason' => $failureReason]);

            if ($refundRequest) {
                $refundRequest->update(['status' => 'failed']);
            }

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'refund_transaction',
                'entity_id'       => $refundTransaction->id,
                'action'          => 'refund.stripe_failed',
                'metadata'        => [
                    'stripe_refund_id' => $stripeRefundId,
                    'failure_reason'   => $failureReason,
                    'order_number'     => $order->order_number,
                ],
            ]);

            Log::error('RefundService: Stripe refund failed', [
                'stripe_refund_id'     => $stripeRefundId,
                'refund_transaction_id' => $refundTransaction->id,
                'failure_reason'       => $failureReason,
            ]);
        }
    }

    /**
     * Issue a platform credit instead of a monetary refund.
     */
    public function issueCredit(
        RefundRequest $refundRequest,
        int $amountCents,
        int $expiryDays = 365,
    ): PlatformCredit {
        $order = $refundRequest->order ?? $refundRequest->load('order')->order;

        $credit = DB::transaction(function () use ($refundRequest, $order, $amountCents, $expiryDays) {
            $credit = PlatformCredit::create([
                'user_id'                  => $order->user_id,
                'amount_cents'             => $amountCents,
                'currency'                 => $order->currency ?? 'usd',
                'source_type'              => 'refund',
                'source_refund_request_id' => $refundRequest->id,
                'is_used'                  => false,
                'expires_at'               => now()->addDays($expiryDays),
            ]);

            $refundRequest->update([
                'status'       => 'processed',
                'processed_at' => now(),
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'refund_request',
                'entity_id'       => $refundRequest->id,
                'action'          => 'refund.issued_as_credit',
                'metadata'        => [
                    'order_number'    => $order->order_number,
                    'amount_cents'    => $amountCents,
                    'expires_at'      => now()->addDays($expiryDays)->toIso8601String(),
                    'platform_credit_id' => $credit->id,
                ],
            ]);

            return $credit;
        });

        // N-33 email to participant (credit issued)
        Notification::create([
            'organization_id'   => $order->organization_id,
            'sent_by_user_id'   => null,
            'workshop_id'       => null,
            'notification_type' => 'informational',
            'delivery_scope'    => 'all_participants',
            'title'             => 'Platform credit issued',
            'body'              => 'A platform credit of $' . number_format($amountCents / 100, 2)
                . " has been issued to your account for order {$order->order_number}. "
                . "It will expire on {$credit->expires_at->toFormattedDateString()}.",
            'status'            => 'queued',
        ]);

        return $credit;
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function resolveAlreadyRefundedCents(Order $order): int
    {
        return RefundTransaction::query()
            ->where('order_id', $order->id)
            ->whereIn('status', ['pending', 'succeeded'])
            ->sum('amount_cents');
    }

    private function resolveWorkshop(Order $order): ?Workshop
    {
        $order->loadMissing('items');

        $workshopItem = $order->items
            ->where('item_type', 'workshop_registration')
            ->first();

        if (! $workshopItem || ! $workshopItem->workshop_id) {
            return null;
        }

        return Workshop::find($workshopItem->workshop_id);
    }

    private function updateOrderRefundStatus(Order $order, int $refundedCents): void
    {
        $totalRefunded = RefundTransaction::query()
            ->where('order_id', $order->id)
            ->whereIn('status', ['pending', 'succeeded'])
            ->sum('amount_cents');

        if ($totalRefunded >= $order->total_cents) {
            $order->update(['status' => 'fully_refunded']);
        } else {
            $order->update(['status' => 'partially_refunded']);
        }
    }

    private function updateOrderItemRefundStatus(int $orderItemId, int $refundedCents): void
    {
        $item = OrderItem::find($orderItemId);
        if (! $item) {
            return;
        }

        $newRefunded = ($item->refunded_amount_cents ?? 0) + $refundedCents;

        $refundStatus = $newRefunded >= $item->line_total_cents ? 'fully_refunded' : 'partially_refunded';

        $item->update([
            'refunded_amount_cents' => $newRefunded,
            'refund_status'         => $refundStatus,
        ]);
    }
}
