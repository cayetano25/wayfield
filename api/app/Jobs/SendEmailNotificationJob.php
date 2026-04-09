<?php

namespace App\Jobs;

use App\Mail\WorkshopNotificationMail;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Throwable;

class SendEmailNotificationJob implements ShouldQueue
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

        if (! $recipient || $recipient->email_status !== 'pending') {
            return;
        }

        $notification = Notification::find($this->notificationId);

        if (! $notification) {
            $recipient->update(['email_status' => 'failed']);

            return;
        }

        $user = $recipient->user;

        if (! $user) {
            $recipient->update(['email_status' => 'failed']);

            return;
        }

        try {
            Mail::to($user->email)->queue(new WorkshopNotificationMail($notification, $user));
            $recipient->update(['email_status' => 'sent']);
        } catch (Throwable $e) {
            $recipient->update(['email_status' => 'failed']);
            throw $e;
        }
    }

    public function failed(Throwable $exception): void
    {
        NotificationRecipient::where('id', $this->recipientId)
            ->where('email_status', 'pending')
            ->update(['email_status' => 'failed']);
    }
}
