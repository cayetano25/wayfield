<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Order;
use App\Models\Notification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-40 (requires_action variant): 2-hour reminder to participant that their
 * payment still needs 3DS/SCA verification to complete.
 *
 * Scheduled by ProcessStripeConnectWebhookJob when payment_intent.requires_action
 * is received. Silently completes if the order was resolved before the reminder fires.
 */
class SendPaymentRequiresActionReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $orderId,
    ) {}

    public function handle(): void
    {
        $order = Order::find($this->orderId);

        if (! $order) {
            Log::warning('SendPaymentRequiresActionReminderJob: order not found', [
                'order_id' => $this->orderId,
            ]);
            return;
        }

        // Order has been resolved since the reminder was scheduled — nothing to do.
        if (in_array($order->status, ['completed', 'cancelled', 'fully_refunded'], true)) {
            Log::info('SendPaymentRequiresActionReminderJob: order already resolved, skipping', [
                'order_id' => $order->id,
                'status'   => $order->status,
            ]);
            return;
        }

        Notification::create([
            'organization_id'    => $order->organization_id,
            'workshop_id'        => null,
            'created_by_user_id' => null,
            'notification_type'  => 'urgent',
            'sender_scope'       => 'organizer',
            'delivery_scope'     => 'all_participants',
            'title'              => 'Payment verification still required',
            'message'            => "Your payment for order {$order->order_number} still needs bank verification. "
                                  . 'Please return to checkout to complete the process before your order expires.',
        ]);

        Log::info('SendPaymentRequiresActionReminderJob: reminder notification created', [
            'order_id'     => $order->id,
            'order_number' => $order->order_number,
        ]);
    }
}
