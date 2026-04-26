<?php

namespace App\Jobs;

use App\Domain\Payments\Models\WaitlistPromotionPayment;
use App\Domain\Payments\Services\WaitlistPromotionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Fires when a waitlist payment window expires without payment.
 * Delegates to WaitlistPromotionService::processWaitlistWindowExpiry().
 */
class ProcessWaitlistWindowExpiryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $promotionPaymentId,
    ) {}

    public function handle(WaitlistPromotionService $service): void
    {
        $promotionPayment = WaitlistPromotionPayment::with('workshop')
            ->find($this->promotionPaymentId);

        if (! $promotionPayment) {
            Log::warning('ProcessWaitlistWindowExpiryJob: promotion payment not found', [
                'promotion_payment_id' => $this->promotionPaymentId,
            ]);
            return;
        }

        $service->processWaitlistWindowExpiry($promotionPayment);
    }
}
