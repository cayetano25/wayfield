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
 * Dispatches balance charge failure notifications.
 *
 * N-62 — urgent email to participant with payment update link.
 * N-63 — notification to organizer.
 *
 * Full mailable wiring is part of Step 5B (balance notification delivery).
 */
class SendBalanceFailedNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int $orderId,
    ) {}

    public function handle(): void
    {
        $order = Order::with('user', 'organization')->find($this->orderId);

        if (! $order) {
            Log::warning('SendBalanceFailedNotificationJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        Log::info('SendBalanceFailedNotificationJob: dispatching N-62/N-63', [
            'order_id'     => $order->id,
            'order_number' => $order->order_number,
        ]);

        // TODO (Step 5B): send N-62 urgent email to participant and N-63 to organizer
    }
}
