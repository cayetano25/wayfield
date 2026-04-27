<?php

namespace App\Jobs\Payments;

use App\Domain\Payments\Models\RefundRequest;
use App\Mail\Payments\RefundApprovedParticipantMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * N-28: Notify participant their refund has been approved (expect 3–5 business days).
 * N-31/N-32 path handled when isAutomatic = true.
 */
class ProcessRefundApprovedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly int $refundRequestId,
        private readonly bool $isAutomatic = false,
    ) {}

    public function handle(): void
    {
        $refundRequest = RefundRequest::with('order.user')
            ->find($this->refundRequestId);

        if (! $refundRequest) {
            Log::warning('ProcessRefundApprovedJob: refund request not found', [
                'refund_request_id' => $this->refundRequestId,
            ]);
            return;
        }

        $participant = $refundRequest->order?->user;

        if (! $participant) {
            return;
        }

        Mail::to($participant->email)
            ->queue(new RefundApprovedParticipantMail($refundRequest, $this->isAutomatic));
    }
}
