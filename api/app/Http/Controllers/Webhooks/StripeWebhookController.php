<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessStripeConnectWebhookJob;
use App\Models\StripeEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

/**
 * Handles Stripe platform and Connect webhook endpoints.
 *
 * POST /api/webhooks/stripe         — platform billing events (delegates to billing handler)
 * POST /api/webhooks/stripe/connect — Connect account events for payment system
 *
 * All processing is async: the handler records the event and dispatches a job,
 * then returns 200 immediately regardless of processing outcome.
 */
class StripeWebhookController extends Controller
{
    /**
     * POST /api/webhooks/stripe
     * Verifies with STRIPE_WEBHOOK_SECRET.
     * Currently delegates to the existing billing webhook for subscription events.
     * Defined here so the route path is owned by this controller.
     */
    public function handle(Request $request): JsonResponse
    {
        $payload   = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $secret    = config('stripe.webhook_secret');

        if (! $secret) {
            Log::warning('StripeWebhookController: STRIPE_WEBHOOK_SECRET is not configured');
            return response()->json(['received' => true]);
        }

        try {
            $event = Webhook::constructEvent($payload, $sigHeader, $secret);
        } catch (SignatureVerificationException $e) {
            Log::warning('StripeWebhookController: signature verification failed', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['error' => 'Invalid signature'], 400);
        }

        $record = StripeEvent::firstOrCreate(
            ['stripe_event_id' => $event->id],
            [
                'event_type'   => $event->type,
                'livemode'     => (bool) ($event->livemode ?? false),
                'payload_json' => json_decode($payload, true),
            ],
        );

        if (! $record->isProcessed()) {
            // Billing events (subscription, invoice) are handled by the existing
            // StripeWebhookController in Api/V1. This endpoint is a pass-through
            // for any new billing events routed here in future.
            Log::info('StripeWebhookController: billing event received', [
                'type'     => $event->type,
                'event_id' => $event->id,
            ]);
        }

        return response()->json(['received' => true]);
    }

    /**
     * POST /api/webhooks/stripe/connect
     * Verifies with STRIPE_CONNECT_WEBHOOK_SECRET.
     * Enqueues a job for all Connect account events — never processes synchronously.
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
}
