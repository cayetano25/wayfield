<?php

namespace App\Jobs\Payments;

use App\Domain\Payments\Models\RefundRequest;
use App\Mail\Payments\RefundRequestReceivedOrganizerMail;
use App\Models\Organization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * N-27: Notify organizer that a refund request requires their review.
 */
class ProcessRefundRequestedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(
        private readonly int $refundRequestId,
    ) {}

    public function handle(): void
    {
        $refundRequest = RefundRequest::with('order.organization', 'requestedBy')
            ->find($this->refundRequestId);

        if (! $refundRequest) {
            Log::warning('ProcessRefundRequestedJob: refund request not found', [
                'refund_request_id' => $this->refundRequestId,
            ]);
            return;
        }

        $organization = $refundRequest->order?->organization;

        if (! $organization) {
            return;
        }

        // Send to all owner/admin members of the organization
        $recipients = $organization->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->get();

        foreach ($recipients as $recipient) {
            Mail::to($recipient->email)
                ->queue(new RefundRequestReceivedOrganizerMail($refundRequest, $recipient));
        }
    }
}
