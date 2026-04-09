<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\PushToken;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        public readonly int $notificationId,
        public readonly int $recipientId,
    ) {}

    public function handle(): void
    {
        $recipient = NotificationRecipient::find($this->recipientId);

        if (! $recipient || $recipient->push_status !== 'pending') {
            return;
        }

        $notification = Notification::find($this->notificationId);

        if (! $notification) {
            $recipient->update(['push_status' => 'failed']);

            return;
        }

        // Fetch all active push tokens for this user
        $tokens = PushToken::where('user_id', $recipient->user_id)
            ->where('is_active', true)
            ->pluck('push_token')
            ->all();

        if (empty($tokens)) {
            // No active tokens — skip gracefully
            $recipient->update(['push_status' => 'skipped']);

            return;
        }

        try {
            $this->sendToExpoPush($tokens, $notification);
            $recipient->update(['push_status' => 'sent']);
        } catch (Throwable $e) {
            $recipient->update(['push_status' => 'failed']);
            Log::error('Push notification delivery failed', [
                'notification_id' => $this->notificationId,
                'recipient_id' => $this->recipientId,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Deliver via Expo Push Notifications API.
     *
     * In production this calls https://exp.host/--/api/v2/push/send.
     * In local development no HTTP call is made (driver = log).
     */
    private function sendToExpoPush(array $tokens, Notification $notification): void
    {
        $messages = array_map(fn (string $token) => [
            'to' => $token,
            'title' => $notification->title,
            'body' => $notification->message,
            'data' => [
                'notification_id' => $notification->id,
                'workshop_id' => $notification->workshop_id,
                'type' => $notification->notification_type,
            ],
            'priority' => $notification->notification_type === 'urgent' ? 'high' : 'default',
        ], $tokens);

        $pushEndpoint = config('services.expo_push.endpoint', 'https://exp.host/--/api/v2/push/send');

        // Skip actual HTTP call in local/testing environments
        if (app()->environment(['local', 'testing'])) {
            Log::channel('single')->info('[Expo Push] Simulated delivery', [
                'tokens' => $tokens,
                'title' => $notification->title,
                'body' => $notification->message,
            ]);

            return;
        }

        $response = Http::withHeaders(['Accept' => 'application/json'])
            ->post($pushEndpoint, $messages);

        if ($response->failed()) {
            throw new \RuntimeException('Expo push delivery failed: '.$response->body());
        }
    }

    public function failed(Throwable $exception): void
    {
        NotificationRecipient::where('id', $this->recipientId)
            ->where('push_status', 'pending')
            ->update(['push_status' => 'failed']);
    }
}
