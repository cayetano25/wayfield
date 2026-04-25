<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Cart;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Marks active carts as 'abandoned' when their TTL has elapsed.
 * Scheduled hourly via app/Console/Kernel.php (job_type = 'cart_expiry').
 */
class CartExpiryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $expired = Cart::query()
            ->where('status', 'active')
            ->where('expires_at', '<', now())
            ->update(['status' => 'abandoned']);

        if ($expired > 0) {
            Log::info('CartExpiryJob: marked carts as abandoned', ['count' => $expired]);
        }
    }
}
