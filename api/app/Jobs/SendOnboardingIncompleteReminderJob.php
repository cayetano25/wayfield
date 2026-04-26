<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Domain\Payments\Models\StripeConnectAccount;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-46: Remind org owners/admins that Stripe onboarding is incomplete.
 *
 * Includes a link to resume onboarding at /settings/payments and explains
 * what becomes available once Stripe Connect is active.
 */
class SendOnboardingIncompleteReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $stripeConnectAccountId,
    ) {}

    public function handle(): void
    {
        $account = StripeConnectAccount::with('organization')->find($this->stripeConnectAccountId);

        if (! $account) {
            Log::warning('SendOnboardingIncompleteReminderJob: account not found', [
                'stripe_connect_account_id' => $this->stripeConnectAccountId,
            ]);
            return;
        }

        // Skip if onboarding was completed after the job was scheduled.
        if ($account->onboarding_status === 'complete' || $account->charges_enabled) {
            return;
        }

        $org = $account->organization;

        if (! $org) {
            return;
        }

        $orgAdmins = $org->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->wherePivot('is_active', true)
            ->get();

        foreach ($orgAdmins as $admin) {
            $emailLog = EmailLog::create([
                'recipient_user_id'    => $admin->id,
                'recipient_email'      => $admin->email,
                'notification_code'    => 'N-46',
                'subject'              => "Action required: Complete your Stripe onboarding for {$org->name}",
                'template_name'        => 'payments.onboarding-incomplete-reminder',
                'provider'             => 'ses',
                'status'               => 'queued',
                'related_entity_type'  => 'stripe_connect_account',
                'related_entity_id'    => $account->id,
                'metadata_json'        => [
                    'organization_id'   => $org->id,
                    'onboarding_url'    => url('/settings/payments'),
                ],
            ]);

            Log::info('SendOnboardingIncompleteReminderJob: N-46 queued', [
                'stripe_connect_account_id' => $account->id,
                'organization_id'           => $org->id,
                'admin_id'                  => $admin->id,
            ]);

            $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
        }
    }
}
