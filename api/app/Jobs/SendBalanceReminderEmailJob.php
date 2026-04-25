<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Services\BalancePaymentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Sends a balance payment reminder email (N-56 / N-57 / N-58).
 *
 * When balance_auto_charge = true, this is informational — the charge will
 * happen automatically on the due date.
 * When balance_auto_charge = false, this generates a payment link (N-61) so
 * the participant can pay manually.
 */
class SendBalanceReminderEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int    $orderId,
        private readonly string $notificationCode,
    ) {}

    public function handle(BalancePaymentService $service): void
    {
        $order = Order::with('organization', 'items', 'user')->find($this->orderId);

        if (! $order) {
            Log::warning('SendBalanceReminderEmailJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        if ($order->balance_paid_at !== null) {
            return;
        }

        if (! $order->balance_auto_charge) {
            // Payment link path: create a PaymentIntent and email the participant.
            $service->createBalancePaymentLink($order);
            return;
        }

        // Auto-charge path: send an informational reminder.
        // TODO (Step 5B): wire to dedicated balance reminder Mailable
        Log::info('SendBalanceReminderEmailJob: informational reminder queued', [
            'order_id'          => $order->id,
            'notification_code' => $this->notificationCode,
        ]);
    }
}
