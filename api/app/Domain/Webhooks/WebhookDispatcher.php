<?php

namespace App\Domain\Webhooks;

use App\Jobs\DeliverWebhookJob;
use App\Models\WebhookEndpoint;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Dispatches webhook events to subscribed organization endpoints.
 *
 * Delivery is always asynchronous — events are queued via DeliverWebhookJob.
 * A failure to find or queue a webhook must never propagate to the caller.
 * Wrap calls in try/catch at the call site.
 */
class WebhookDispatcher
{
    /**
     * Dispatch a webhook event to all active endpoints for an organization
     * that subscribe to the given event type.
     *
     * Each matching endpoint gets its own queued DeliverWebhookJob.
     * This method does NOT deliver synchronously.
     *
     * @param  string  $eventType  e.g. 'workshop.published'
     * @param  int  $organizationId  The tenant this event belongs to.
     * @param  array  $data  The event-specific payload (the 'data' object).
     */
    public function dispatch(string $eventType, int $organizationId, array $data): void
    {
        $endpoints = WebhookEndpoint::where('organization_id', $organizationId)
            ->where('is_active', true)
            ->get();

        foreach ($endpoints as $endpoint) {
            if (! $endpoint->isSubscribedTo($eventType)) {
                continue;
            }

            $event = [
                'event_id' => (string) Str::uuid(),
                'event_type' => $eventType,
                'created_at' => now()->toIso8601String(),
                'organization_id' => $organizationId,
                'data' => $data,
            ];

            // Decrypt the stored secret for use in HMAC signing inside the job.
            // The raw secret must be passed to the job because it is not stored
            // in plain text and cannot be re-derived from the encrypted column
            // without decrypting it first.
            try {
                $rawSecret = decrypt($endpoint->secret_encrypted);
            } catch (\Throwable $e) {
                Log::warning('WebhookDispatcher: failed to decrypt secret for endpoint', [
                    'endpoint_id' => $endpoint->id,
                    'error' => $e->getMessage(),
                ]);

                continue;
            }

            DeliverWebhookJob::dispatch($endpoint->id, $event, $rawSecret);
        }
    }

    /**
     * Generate an HMAC-SHA256 signature for a webhook payload.
     *
     * The receiving server verifies authenticity by computing:
     *   hash_hmac('sha256', $rawPayload, $sharedSecret)
     * and comparing it to the X-Wayfield-Signature header value using
     * a timing-safe comparison (hash_equals).
     *
     * Example verification in PHP:
     *   $expected = hash_hmac('sha256', file_get_contents('php://input'), $secret);
     *   if (!hash_equals($expected, $_SERVER['HTTP_X_WAYFIELD_SIGNATURE'])) {
     *       abort(401);
     *   }
     *
     * @param  string  $rawSecret  The plain-text signing secret.
     * @param  string  $payload  The JSON-encoded payload string (not decoded array).
     * @return string Lowercase hex HMAC-SHA256 digest.
     */
    public function generateSignature(string $rawSecret, string $payload): string
    {
        return hash_hmac('sha256', $payload, $rawSecret);
    }
}
