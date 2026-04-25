<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-61 — sends the balance payment link email to the participant
 * when balance_auto_charge = false.
 *
 * Full mailable wiring is part of Step 5B (balance notification delivery).
 */
class SendBalancePaymentLinkJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int    $orderId,
        private readonly string $clientSecret,
    ) {}

    public function handle(): void
    {
        $order = Order::with('user', 'organization')->find($this->orderId);

        if (! $order) {
            Log::warning('SendBalancePaymentLinkJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        Log::info('SendBalancePaymentLinkJob: dispatching N-61', [
            'order_id'     => $order->id,
            'order_number' => $order->order_number,
        ]);

        // TODO (Step 5B): send N-61 email with payment link to participant
    }
}
