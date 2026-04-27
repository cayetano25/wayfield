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

class ProcessBalanceChargeJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(
        private readonly int $orderId,
    ) {}

    public function handle(BalancePaymentService $service): void
    {
        $order = Order::with('organization', 'items')->find($this->orderId);

        if (! $order) {
            Log::warning('ProcessBalanceChargeJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        $service->processAutoBalanceCharge($order);
    }
}
