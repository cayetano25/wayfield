<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessStripeBillingWebhookJob;
use App\Jobs\ProcessStripeConnectWebhookJob;
use App\Models\StripeEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

/**
 * Canonical handler for all Stripe webhook endpoints.
 *
 * POST /api/webhooks/stripe         — platform billing events (subscription, invoice, checkout)
 * POST /api/webhooks/stripe/connect — Connect account events for the payment system
 *
 * Both methods return 200 immediately and process asynchronously via queued jobs.
 * The legacy routes /api/v1/billing/webhook and /api/v1/stripe/webhook are deprecated
 * and return 200 with a deprecation warning only.
 */
class StripeWebhookController extends Controller
{
    /**
     * POST /api/webhooks/stripe
     * Canonical handler for all Wayfield platform billing events.
     * Verifies signature with STRIPE_WEBHOOK_SECRET, deduplicates via Cache,
     * then dispatches ProcessStripeBillingWebhookJob for async processing.
     */
    public function handle(Request $request): Response
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $secret    = config('stripe.webhook_secret');

        if (! $secret) {
            Log::critical('StripeWebhookController: STRIPE_WEBHOOK_SECRET is not configured');
            return response('Configuration error', 500);
        }

        try {
            $event = Webhook::constructEvent($payload, $sigHeader, $secret);
        } catch (SignatureVerificationException $e) {
            Log::warning('StripeWebhookController: signature verification failed', [
                'error' => $e->getMessage(),
                'route' => 'platform_billing',
            ]);
            return response('Signature verification failed', 400);
        } catch (\Exception $e) {
            Log::error('StripeWebhookController: invalid payload', ['error' => $e->getMessage()]);
            return response('Invalid payload', 400);
        }

        if ($this->alreadyReceived($event->id)) {
            Log::info('StripeWebhookController: event already received', [
                'event_id' => $event->id,
                'type'     => $event->type,
            ]);
            return response('Already processed', 200);
        }

        ProcessStripeBillingWebhookJob::dispatch($event->toArray());
        $this->markReceived($event->id, $event->type);

        return response('Received', 200);
    }

    /**
     * POST /api/webhooks/stripe/connect
     * Handles Stripe Connect account events for the payment system.
     * Verifies with STRIPE_CONNECT_WEBHOOK_SECRET and enqueues ProcessStripeConnectWebhookJob.
     */
    public function handleConnect(Request $request): JsonResponse
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $secret    = config('stripe.connect_webhook_secret');

        if (! $secret) {
            // Accept without verification in local/testing where secret is not set.
            if (! app()->environment(['local', 'testing'])) {
                Log::critical('StripeWebhookController: STRIPE_CONNECT_WEBHOOK_SECRET is not configured');
                return response()->json(['received' => true]);
            }

            $eventData = json_decode($payload, true);
            $eventId   = $eventData['id'] ?? ('local_'.uniqid());
            $eventType = $eventData['type'] ?? 'unknown';
        } else {
            try {
                $event     = Webhook::constructEvent($payload, $sigHeader, $secret);
                $eventId   = $event->id;
                $eventType = $event->type;
                $eventData = json_decode($payload, true);
            } catch (SignatureVerificationException $e) {
                Log::warning('StripeWebhookController: Connect signature verification failed', [
                    'error' => $e->getMessage(),
                ]);
                return response()->json(['error' => 'Invalid signature'], 400);
            }
        }

        // Idempotency: skip duplicate events already enqueued or processed.
        $record = StripeEvent::firstOrCreate(
            ['stripe_event_id' => $eventId],
            [
                'event_type'   => $eventType,
                'livemode'     => (bool) ($eventData['livemode'] ?? false),
                'payload_json' => $eventData,
            ],
        );

        if (! $record->isProcessed()) {
            ProcessStripeConnectWebhookJob::dispatch($record->id);
        }

        // Always return 200 so Stripe stops retrying even if the job fails later.
        return response()->json(['received' => true]);
    }

    // ── Idempotency helpers ────────────────────────────────────────────────────

    private function alreadyReceived(string $eventId): bool
    {
        return Cache::has("stripe_billing_event_{$eventId}");
    }

    private function markReceived(string $eventId, string $eventType): void
    {
        // Cache for 24 hours — Stripe's retry window.
        Cache::put(
            "stripe_billing_event_{$eventId}",
            ['type' => $eventType, 'received_at' => now()->toIso8601String()],
            now()->addHours(24),
        );
    }
}
