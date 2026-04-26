<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Order;
use App\Domain\Payments\Models\RefundPolicy;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Mail\Payments\PaymentConfirmationMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Dispatches order confirmation emails (N-01/N-03 participant, N-02/N-04 organizer).
 *
 * N-01 / N-02 — free order confirmations
 * N-03 / N-04 — paid order confirmations
 *
 * Full notification template wiring is part of the payment notifications
 * delivery phase (Step 4B). This job is a placeholder so CheckoutService
 * can dispatch without coupling to a future mailable class.
 */
class SendOrderConfirmationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public function __construct(
        private readonly int $orderId,
    ) {}

    public function handle(): void
    {
        $order = Order::with('user', 'organization', 'items.workshop', 'items.session')
            ->find($this->orderId);

        if (! $order) {
            Log::warning('SendOrderConfirmationJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        Log::info('SendOrderConfirmationJob: order confirmation sending', [
            'order_id'       => $order->id,
            'order_number'   => $order->order_number,
            'payment_method' => $order->payment_method,
            'user_id'        => $order->user_id,
        ]);

        // N-03: paid order confirmation to participant
        if ($order->payment_method !== 'free' && $order->user) {
            $workshopId = $order->items->first()?->workshop_id;

            $pricing = $workshopId
                ? WorkshopPricing::where('workshop_id', $workshopId)->first()
                : null;

            $refundPolicy = $workshopId
                ? RefundPolicy::where('workshop_id', $workshopId)->latest()->first()
                : null;

            Mail::to($order->user->email)->queue(
                new PaymentConfirmationMail($order, $pricing, $refundPolicy),
            );
        }
    }
}
