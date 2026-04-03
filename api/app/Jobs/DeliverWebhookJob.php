<?php

namespace App\Jobs;

use App\Domain\Webhooks\WebhookDispatcher;
use App\Models\SecurityEvent;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Delivers a single webhook event to one endpoint URL.
 *
 * Retry schedule (attempt_count):
 *   1st failure → retry after 5 minutes
 *   2nd failure → retry after 30 minutes
 *   3rd failure → retry after 2 hours
 *   4th+ failure → permanently failed, no further retries
 *
 * Circuit breaker: if an endpoint accumulates >= 10 consecutive failures,
 * it is automatically deactivated and a security_events row is written.
 *
 * Timeout: 10 seconds per request. Slow endpoints must not block the queue.
 *
 * The raw signing secret is passed as a constructor argument because
 * only the encrypted form is stored in the database — it must be decrypted
 * at dispatch time and passed through to the job.
 */
class DeliverWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Retry delays in seconds by attempt number (1-indexed)
    private const RETRY_DELAYS = [
        1 => 300,    // 5 minutes
        2 => 1800,   // 30 minutes
        3 => 7200,   // 2 hours
    ];

    private const MAX_ATTEMPTS  = 3;
    private const CIRCUIT_LIMIT = 10;
    private const TIMEOUT_SECS  = 10;

    public function __construct(
        private readonly int    $endpointId,
        private readonly array  $event,
        private readonly string $rawSecret,
    ) {}

    public function handle(WebhookDispatcher $dispatcher): void
    {
        $endpoint = WebhookEndpoint::find($this->endpointId);

        if (! $endpoint || ! $endpoint->is_active) {
            return;
        }

        $deliveryUuid = (string) Str::uuid();
        $payload      = json_encode($this->event);
        $signature    = $dispatcher->generateSignature($this->rawSecret, $payload);

        // Create the delivery record before attempting — provides an audit trail
        // even if the HTTP request never completes.
        $delivery = WebhookDelivery::create([
            'webhook_endpoint_id' => $endpoint->id,
            'organization_id'     => $endpoint->organization_id,
            'webhook_url'         => $endpoint->url,
            'event_type'          => $this->event['event_type'],
            'payload_json'        => $this->event,
            'attempt_count'       => 0,
        ]);

        try {
            $response = Http::timeout(self::TIMEOUT_SECS)
                ->withHeaders([
                    'Content-Type'            => 'application/json',
                    'X-Wayfield-Event'        => $this->event['event_type'],
                    'X-Wayfield-Delivery'     => $deliveryUuid,
                    'X-Wayfield-Signature'    => $signature,
                ])
                ->post($endpoint->url, $this->event);

            $delivery->update([
                'response_status' => $response->status(),
                'response_body'   => substr($response->body(), 0, 2000),
                'attempt_count'   => $delivery->attempt_count + 1,
            ]);

            if ($response->successful()) {
                $delivery->update(['delivered_at' => now()]);
                $endpoint->update([
                    'last_success_at' => now(),
                    'failure_count'   => 0,
                ]);
                return;
            }

            // Non-2xx response — treat as failure
            $this->handleFailure($endpoint, $delivery);

        } catch (\Throwable $e) {
            Log::warning('DeliverWebhookJob: HTTP exception', [
                'endpoint_id' => $endpoint->id,
                'url'         => $endpoint->url,
                'error'       => $e->getMessage(),
            ]);

            $delivery->update([
                'attempt_count' => $delivery->attempt_count + 1,
                'response_body' => 'Exception: ' . $e->getMessage(),
            ]);

            $this->handleFailure($endpoint, $delivery);
        }
    }

    private function handleFailure(WebhookEndpoint $endpoint, WebhookDelivery $delivery): void
    {
        $newFailureCount = $endpoint->failure_count + 1;

        $endpoint->update([
            'failure_count'   => $newFailureCount,
            'last_failure_at' => now(),
        ]);

        $attemptCount = $delivery->attempt_count;

        // Schedule retry if within attempt limit
        if ($attemptCount <= self::MAX_ATTEMPTS && isset(self::RETRY_DELAYS[$attemptCount])) {
            $nextRetryAt = now()->addSeconds(self::RETRY_DELAYS[$attemptCount]);
            $delivery->update(['next_retry_at' => $nextRetryAt]);

            // Re-dispatch the same job with a delay
            self::dispatch($this->endpointId, $this->event, $this->rawSecret)
                ->delay($nextRetryAt);
        }

        // Circuit breaker: too many consecutive failures → deactivate endpoint
        if ($newFailureCount >= self::CIRCUIT_LIMIT) {
            $endpoint->update(['is_active' => false]);

            SecurityEvent::create([
                'organization_id' => $endpoint->organization_id,
                'event_type'      => 'webhook_endpoint_disabled',
                'severity'        => 'low',
                'metadata_json'   => [
                    'endpoint_id'   => $endpoint->id,
                    'url'           => $endpoint->url,
                    'failure_count' => $newFailureCount,
                    'reason'        => 'Automatically disabled after ' . self::CIRCUIT_LIMIT . ' consecutive delivery failures.',
                ],
            ]);
        }
    }
}
