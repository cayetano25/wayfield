<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Payments\Models\EmailLog;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Receives delivery status notifications from AWS SES via Amazon SNS.
 *
 * SNS sends a subscription confirmation before delivery events begin — that
 * request is handled here so the topic is confirmed automatically.
 *
 * All messages are verified against the SNS signature before processing.
 */
class SesWebhookController extends Controller
{
    // SNS message types
    private const TYPE_SUBSCRIPTION_CONFIRMATION = 'SubscriptionConfirmation';
    private const TYPE_NOTIFICATION              = 'Notification';

    public function handle(Request $request): JsonResponse
    {
        $payload = json_decode($request->getContent(), true);

        if (! $payload || ! isset($payload['Type'])) {
            return response()->json(['error' => 'invalid_payload'], 400);
        }

        if (! $this->verifySignature($payload)) {
            Log::warning('SesWebhookController: SNS signature verification failed', [
                'message_id' => $payload['MessageId'] ?? null,
            ]);
            return response()->json(['error' => 'invalid_signature'], 403);
        }

        match ($payload['Type']) {
            self::TYPE_SUBSCRIPTION_CONFIRMATION => $this->confirmSubscription($payload),
            self::TYPE_NOTIFICATION              => $this->processNotification($payload),
            default                              => Log::info('SesWebhookController: unhandled SNS type', ['type' => $payload['Type']]),
        };

        return response()->json(['received' => true]);
    }

    // ─── Subscription confirmation ────────────────────────────────────────────

    private function confirmSubscription(array $payload): void
    {
        $subscribeUrl = $payload['SubscribeURL'] ?? null;

        if (! $subscribeUrl) {
            Log::warning('SesWebhookController: SubscribeURL missing from confirmation payload');
            return;
        }

        Http::get($subscribeUrl);

        Log::info('SesWebhookController: SNS subscription confirmed', [
            'topic_arn' => $payload['TopicArn'] ?? null,
        ]);
    }

    // ─── Delivery event processing ────────────────────────────────────────────

    private function processNotification(array $payload): void
    {
        $message = json_decode($payload['Message'] ?? '{}', true);

        if (! $message) {
            return;
        }

        $eventType = $message['notificationType'] ?? $message['eventType'] ?? null;

        match ($eventType) {
            'Delivery'  => $this->handleDelivery($message),
            'Bounce'    => $this->handleBounce($message),
            'Complaint' => $this->handleComplaint($message),
            default     => Log::info('SesWebhookController: unhandled SES event type', ['type' => $eventType]),
        };
    }

    private function handleDelivery(array $message): void
    {
        $recipients  = $message['delivery']['recipients'] ?? [];
        $timestamp   = $message['delivery']['timestamp'] ?? now()->toIso8601String();
        $messageId   = $message['mail']['messageId'] ?? null;

        if (! $messageId) {
            return;
        }

        $updated = EmailLog::where('provider_message_id', $messageId)
            ->update([
                'status'       => 'delivered',
                'delivered_at' => $timestamp,
            ]);

        Log::info('SesWebhookController: delivery event processed', [
            'message_id' => $messageId,
            'recipients' => $recipients,
            'updated'    => $updated,
        ]);
    }

    private function handleBounce(array $message): void
    {
        $bounce    = $message['bounce'] ?? [];
        $messageId = $message['mail']['messageId'] ?? null;
        $type      = $bounce['bounceType'] ?? 'unknown';
        $subType   = $bounce['bounceSubType'] ?? 'unknown';

        if (! $messageId) {
            return;
        }

        $updated = EmailLog::where('provider_message_id', $messageId)
            ->update([
                'status'        => 'bounced',
                'error_message' => "Bounce: {$type} / {$subType}",
            ]);

        Log::warning('SesWebhookController: bounce event', [
            'message_id' => $messageId,
            'type'       => $type,
            'sub_type'   => $subType,
            'updated'    => $updated,
        ]);
    }

    private function handleComplaint(array $message): void
    {
        $messageId = $message['mail']['messageId'] ?? null;

        if (! $messageId) {
            return;
        }

        $updated = EmailLog::where('provider_message_id', $messageId)
            ->update(['status' => 'complained']);

        Log::warning('SesWebhookController: complaint event', [
            'message_id' => $messageId,
            'updated'    => $updated,
        ]);
    }

    // ─── SNS signature verification ───────────────────────────────────────────

    /**
     * Verify an SNS message signature.
     *
     * SNS signs messages with an RSA key. The public certificate URL is included
     * in the message. We fetch the cert, extract the public key, and verify the
     * canonical string that SNS signs.
     *
     * @see https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
     */
    private function verifySignature(array $payload): bool
    {
        // In testing we skip live certificate verification.
        if (app()->environment('testing')) {
            return true;
        }

        $signingCertUrl = $payload['SigningCertURL'] ?? null;
        $signature      = $payload['Signature'] ?? null;

        if (! $signingCertUrl || ! $signature) {
            return false;
        }

        // Certificate must be hosted on amazonaws.com.
        if (! preg_match('#^https://sns\.[a-z0-9-]+\.amazonaws\.com/#', $signingCertUrl)) {
            Log::warning('SesWebhookController: suspicious SigningCertURL', ['url' => $signingCertUrl]);
            return false;
        }

        try {
            $certPem    = Http::get($signingCertUrl)->body();
            $publicKey  = openssl_get_publickey($certPem);

            if (! $publicKey) {
                return false;
            }

            $stringToSign = $this->buildSigningString($payload);

            $result = openssl_verify(
                $stringToSign,
                base64_decode($signature),
                $publicKey,
                OPENSSL_ALGO_SHA1,
            );

            return $result === 1;
        } catch (\Throwable $e) {
            Log::error('SesWebhookController: signature verification error', ['error' => $e->getMessage()]);
            return false;
        }
    }

    private function buildSigningString(array $payload): string
    {
        $type = $payload['Type'] ?? '';

        if ($type === self::TYPE_NOTIFICATION) {
            $fields = ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'];
        } else {
            $fields = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
        }

        $lines = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $payload)) {
                $lines[] = $field;
                $lines[] = $payload[$field];
            }
        }

        return implode("\n", $lines) . "\n";
    }
}
