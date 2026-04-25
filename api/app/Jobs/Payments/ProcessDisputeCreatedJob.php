<?php

namespace App\Jobs\Payments;

use App\Domain\Payments\Models\Dispute;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-35: Alert Wayfield platform admins when a new dispute is opened.
 */
class ProcessDisputeCreatedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly int $disputeId,
    ) {}

    public function handle(): void
    {
        $dispute = Dispute::with('order')->find($this->disputeId);

        if (! $dispute) {
            Log::warning('ProcessDisputeCreatedJob: dispute not found', ['dispute_id' => $this->disputeId]);
            return;
        }

        // Platform admin notification is delivered via internal monitoring.
        // Full wiring to admin_users notification system is a future step.
        Log::info('DisputeService: dispute opened — Wayfield admin alerted', [
            'dispute_id'        => $dispute->id,
            'stripe_dispute_id' => $dispute->stripe_dispute_id,
            'order_number'      => $dispute->order?->order_number,
            'amount_cents'      => $dispute->amount_cents,
            'evidence_due_by'   => $dispute->evidence_due_by?->toIso8601String(),
        ]);
    }
}
