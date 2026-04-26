<?php

declare(strict_types=1);

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Models\Dispute;
use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Shared\Services\AuditLogService;
use App\Jobs\Payments\ProcessDisputeClosedJob;
use App\Jobs\Payments\ProcessDisputeCreatedJob;
use App\Mail\Payments\DisputeOpenedMail;
use App\Models\Notification;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class DisputeService
{
    /**
     * Handle charge.dispute.created Stripe webhook event.
     */
    public function handleDisputeCreated(array $stripeEvent): void
    {
        $disputeData = $stripeEvent['data']['object'] ?? [];
        $chargeId    = $disputeData['charge'] ?? null;

        if (! $chargeId) {
            Log::warning('DisputeService: charge.dispute.created missing charge id');
            return;
        }

        $order = Order::query()
            ->where('stripe_charge_id', $chargeId)
            ->first();

        if (! $order) {
            Log::warning('DisputeService: order not found for charge', ['charge_id' => $chargeId]);
            return;
        }

        $stripeDisputeId = $disputeData['id'] ?? null;
        $evidenceDueBy   = isset($disputeData['evidence_details']['due_by'])
            ? Carbon::createFromTimestamp($disputeData['evidence_details']['due_by'])
            : null;

        // Idempotent: skip if dispute record already exists
        $existing = Dispute::query()
            ->where('stripe_dispute_id', $stripeDisputeId)
            ->first();

        if ($existing) {
            return;
        }

        $connectAccountId = $disputeData['account'] ?? '';

        $dispute = Dispute::create([
            'order_id'            => $order->id,
            'stripe_dispute_id'   => $stripeDisputeId,
            'stripe_charge_id'    => $chargeId,
            'stripe_account_id'   => $connectAccountId,
            'amount_cents'        => $disputeData['amount'] ?? 0,
            'currency'            => $disputeData['currency'] ?? 'usd',
            'reason'              => $disputeData['reason'] ?? 'unknown',
            'status'              => $disputeData['status'] ?? 'needs_response',
            'evidence_due_by'     => $evidenceDueBy,
            'is_charge_refundable' => $disputeData['is_charge_refundable'] ?? true,
            'network_reason_code' => $disputeData['payment_method_details']['card']['network_reason_code'] ?? null,
            'stripe_metadata_json' => $disputeData,
        ]);

        $order->update(['status' => 'disputed']);

        // N-34: URGENT email + in-app to organizer
        Notification::create([
            'organization_id'   => $order->organization_id,
            'sent_by_user_id'   => null,
            'workshop_id'       => null,
            'notification_type' => 'urgent',
            'delivery_scope'    => 'all_participants',
            'title'             => 'Payment dispute opened — action required',
            'body'              => "A dispute has been filed for order {$order->order_number}. "
                . ($evidenceDueBy ? "Evidence must be submitted by {$evidenceDueBy->toFormattedDateString()}. " : '')
                . 'Please log into your Stripe dashboard to respond. Include your registration confirmation, communications with the participant, and any relevant event details.',
            'status'            => 'queued',
        ]);

        // N-34: email to org owners/admins
        $orgAdmins = $order->organization->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->wherePivot('is_active', true)
            ->get();

        foreach ($orgAdmins as $admin) {
            Mail::to($admin->email)->queue(new DisputeOpenedMail($dispute, $order, $admin));
        }

        // N-35: in-app to Wayfield platform admins (dispatched via job)
        ProcessDisputeCreatedJob::dispatch($dispute->id);

        // Schedule evidence deadline reminder (N-36) — 3 days before due date
        if ($evidenceDueBy) {
            $reminderAt = $evidenceDueBy->copy()->subDays(3)->setTime(9, 0, 0);

            if ($reminderAt->isFuture()) {
                ScheduledPaymentJob::create([
                    'job_type'            => 'dispute_evidence_reminder',
                    'notification_code'   => 'N-36',
                    'related_entity_type' => 'dispute',
                    'related_entity_id'   => $dispute->id,
                    'user_id'             => $order->user_id,
                    'scheduled_for'       => $reminderAt,
                    'status'              => 'pending',
                    'max_attempts'        => 3,
                ]);
            }
        }

        AuditLogService::record([
            'organization_id' => $order->organization_id,
            'actor_user_id'   => null,
            'entity_type'     => 'dispute',
            'entity_id'       => $dispute->id,
            'action'          => 'dispute.opened',
            'metadata'        => [
                'stripe_dispute_id' => $stripeDisputeId,
                'order_number'      => $order->order_number,
                'amount_cents'      => $dispute->amount_cents,
                'reason'            => $dispute->reason,
                'evidence_due_by'   => $evidenceDueBy?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Handle charge.dispute.updated Stripe webhook event.
     */
    public function handleDisputeUpdated(array $stripeEvent): void
    {
        $disputeData     = $stripeEvent['data']['object'] ?? [];
        $stripeDisputeId = $disputeData['id'] ?? null;

        if (! $stripeDisputeId) {
            Log::warning('DisputeService: charge.dispute.updated missing dispute id');
            return;
        }

        $dispute = Dispute::query()
            ->where('stripe_dispute_id', $stripeDisputeId)
            ->first();

        if (! $dispute) {
            Log::warning('DisputeService: Dispute not found for stripe_dispute_id', [
                'stripe_dispute_id' => $stripeDisputeId,
            ]);
            return;
        }

        $newStatus = $disputeData['status'] ?? $dispute->status;

        $updateData = ['status' => $newStatus];

        if ($newStatus === 'under_review') {
            $updateData['evidence_submitted_at'] = now();
        }

        $dispute->update($updateData);
    }

    /**
     * Handle charge.dispute.closed Stripe webhook event.
     */
    public function handleDisputeClosed(array $stripeEvent): void
    {
        $disputeData     = $stripeEvent['data']['object'] ?? [];
        $stripeDisputeId = $disputeData['id'] ?? null;

        if (! $stripeDisputeId) {
            Log::warning('DisputeService: charge.dispute.closed missing dispute id');
            return;
        }

        $dispute = Dispute::query()
            ->where('stripe_dispute_id', $stripeDisputeId)
            ->first();

        if (! $dispute) {
            Log::warning('DisputeService: Dispute not found for stripe_dispute_id', [
                'stripe_dispute_id' => $stripeDisputeId,
            ]);
            return;
        }

        $newStatus = $disputeData['status'] ?? 'closed';
        $order     = $dispute->order ?? $dispute->load('order')->order;

        $resolution = $this->resolveDisputeOutcome($newStatus);

        $dispute->update([
            'status'      => $newStatus,
            'resolved_at' => now(),
            'resolution'  => $resolution,
        ]);

        if ($resolution === 'won') {
            $order->update(['status' => 'completed']);

            // N-37: email + in-app to organizer (won)
            Notification::create([
                'organization_id'   => $order->organization_id,
                'sent_by_user_id'   => null,
                'workshop_id'       => null,
                'notification_type' => 'informational',
                'delivery_scope'    => 'all_participants',
                'title'             => 'Dispute resolved in your favour',
                'body'              => "The dispute for order {$order->order_number} has been resolved in your favour. "
                    . 'No further action is required.',
                'status'            => 'queued',
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'dispute',
                'entity_id'       => $dispute->id,
                'action'          => 'dispute.resolved_won',
                'metadata'        => [
                    'stripe_dispute_id' => $stripeDisputeId,
                    'order_number'      => $order->order_number,
                ],
            ]);
        } elseif ($resolution === 'lost') {
            $order->update(['status' => 'disputed_lost']);

            // N-38: email + in-app to organizer (lost — include next steps)
            Notification::create([
                'organization_id'   => $order->organization_id,
                'sent_by_user_id'   => null,
                'workshop_id'       => null,
                'notification_type' => 'urgent',
                'delivery_scope'    => 'all_participants',
                'title'             => 'Dispute resolved against you',
                'body'              => "The dispute for order {$order->order_number} was not resolved in your favour. "
                    . 'If you believe this outcome is incorrect, you may have options to appeal — please contact Wayfield support or Stripe directly. '
                    . 'You may also wish to reach out to the participant to resolve the matter directly.',
                'status'            => 'queued',
            ]);

            AuditLogService::record([
                'organization_id' => $order->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'dispute',
                'entity_id'       => $dispute->id,
                'action'          => 'dispute.resolved_lost',
                'metadata'        => [
                    'stripe_dispute_id' => $stripeDisputeId,
                    'order_number'      => $order->order_number,
                ],
            ]);
        }

        // N-39: in-app to Wayfield admin regardless of outcome
        ProcessDisputeClosedJob::dispatch($dispute->id, $resolution);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function resolveDisputeOutcome(string $status): ?string
    {
        return match ($status) {
            'won'  => 'won',
            'lost' => 'lost',
            'charge_refunded', 'warning_closed' => 'withdrawn',
            default => null,
        };
    }
}
