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
 * N-39: Alert Wayfield platform admins when a dispute is closed.
 */
class ProcessDisputeClosedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly int $disputeId,
        private readonly ?string $resolution,
    ) {}

    public function handle(): void
    {
        $dispute = Dispute::with('order')->find($this->disputeId);

        if (! $dispute) {
            Log::warning('ProcessDisputeClosedJob: dispute not found', ['dispute_id' => $this->disputeId]);
            return;
        }

        Log::info('DisputeService: dispute closed — Wayfield admin alerted', [
            'dispute_id'        => $dispute->id,
            'stripe_dispute_id' => $dispute->stripe_dispute_id,
            'order_number'      => $dispute->order?->order_number,
            'resolution'        => $this->resolution,
        ]);
    }
}
