<?php

use App\Jobs\CartExpiryJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Mark expired active carts as abandoned every hour.
Schedule::job(CartExpiryJob::class)->hourly()->name('cart-expiry');

// Process due scheduled payment jobs (balance reminders, charges, expiries, etc.).
Schedule::command('payments:process-scheduled-jobs')
    ->everyFiveMinutes()
    ->name('process-scheduled-payment-jobs')
    ->withoutOverlapping();
