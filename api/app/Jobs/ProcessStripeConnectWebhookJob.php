<?php

namespace App\Jobs;

use App\Domain\Payments\Services\CheckoutService;
use App\Domain\Payments\Services\StripeConnectService;
use App\Models\StripeEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessStripeConnectWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $stripeEventId,
    ) {}

    public function handle(StripeConnectService $service, CheckoutService $checkoutService): void
    {
        $record = StripeEvent::find($this->stripeEventId);

        if (! $record) {
            Log::warning('ProcessStripeConnectWebhookJob: StripeEvent not found', [
                'stripe_event_id' => $this->stripeEventId,
            ]);
            return;
        }

        if ($record->isProcessed()) {
            return;
        }

        $payload = $record->payload_json;
        $type    = $record->event_type;

        try {
            match (true) {
                $type === 'account.updated'
                    => $service->handleAccountUpdatedWebhook($payload),

                $type === 'account.application.deauthorized'
                    => $service->handleAccountDeauthorizedWebhook($payload),

                $type === 'payout.failed'
                    => $service->handlePayoutFailedWebhook($payload),

                $type === 'capability.updated'
                    => $service->handleCapabilityUpdatedWebhook($payload),

                $type === 'payment_intent.succeeded'
                    => $checkoutService->handlePaymentIntentSucceeded($payload),

                $type === 'payment_intent.payment_failed'
                    => $checkoutService->handlePaymentIntentFailed($payload),

                // charge.refund and dispute events deferred to Step 6.
                str_starts_with($type, 'charge.dispute.')
                || str_starts_with($type, 'charge.refund.')
                    => Log::info('ProcessStripeConnectWebhookJob: event deferred to later step', [
                        'type' => $type,
                        'event_id' => $payload['id'] ?? null,
                    ]),

                str_starts_with($type, 'payment_intent.')
                    => Log::info('ProcessStripeConnectWebhookJob: unhandled payment_intent event', [
                        'type' => $type,
                        'event_id' => $payload['id'] ?? null,
                    ]),

                default => Log::info('ProcessStripeConnectWebhookJob: unhandled event type', [
                    'type' => $type,
                ]),
            };

            $record->update(['processed_at' => now()]);
        } catch (\Throwable $e) {
            $record->update(['error_message' => $e->getMessage()]);

            Log::error('ProcessStripeConnectWebhookJob failed', [
                'stripe_event_db_id' => $this->stripeEventId,
                'type'               => $type,
                'error'              => $e->getMessage(),
            ]);

            throw $e;
        }
    }
}
