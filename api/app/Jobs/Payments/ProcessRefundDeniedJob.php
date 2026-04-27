<?php

namespace App\Jobs\Payments;

use App\Domain\Payments\Models\RefundRequest;
use App\Mail\Payments\RefundDeniedParticipantMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * N-30: Notify participant their refund request was denied.
 */
class ProcessRefundDeniedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly int $refundRequestId,
    ) {}

    public function handle(): void
    {
        $refundRequest = RefundRequest::with('order.user')
            ->find($this->refundRequestId);

        if (! $refundRequest) {
            Log::warning('ProcessRefundDeniedJob: refund request not found', [
                'refund_request_id' => $this->refundRequestId,
            ]);
            return;
        }

        $participant = $refundRequest->order?->user;

        if (! $participant) {
            return;
        }

        Mail::to($participant->email)
            ->queue(new RefundDeniedParticipantMail($refundRequest));
    }
}
