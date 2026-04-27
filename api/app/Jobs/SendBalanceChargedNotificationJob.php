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
 * Dispatches balance-charged notifications.
 *
 * N-59 — email to participant confirming balance was charged.
 * N-60 — in-app notification to organizer.
 *
 * Full mailable wiring is part of Step 5B (balance notification delivery).
 */
class SendBalanceChargedNotificationJob implements ShouldQueue
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
            Log::warning('SendBalanceChargedNotificationJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        Log::info('SendBalanceChargedNotificationJob: dispatching N-59/N-60', [
            'order_id'     => $order->id,
            'order_number' => $order->order_number,
        ]);

        // TODO (Step 5B): send N-59 email to participant and N-60 in-app to organizer
    }
}
