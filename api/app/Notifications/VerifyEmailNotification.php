<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class VerifyEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $verifyUrl = url(sprintf(
            '/api/v1/auth/verify-email/%s/%s',
            $notifiable->id,
            sha1($notifiable->email)
        ));

        return (new MailMessage)
            ->subject('Verify Your Email Address')
            ->greeting('Hello '.$notifiable->first_name.',')
            ->line('Please click the button below to verify your email address.')
            ->action('Verify Email', $verifyUrl)
            ->line('If you did not create an account, no further action is required.')
            ->salutation('The Wayfield Team');
    }
}
