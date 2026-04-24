<?php

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Shared\Services\AuditLogService;
use App\Mail\Payments\PaymentsEnabledForOrgMail;
use App\Mail\Payments\StripeConnectDeauthorizedMail;
use App\Mail\Payments\StripeConnectOnboardingCompleteMail;
use App\Mail\Payments\StripeConnectPayoutFailedMail;
use App\Mail\Payments\StripeConnectVerificationRequiredMail;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Stripe\Exception\ApiConnectionException;
use Stripe\Exception\AuthenticationException;
use Stripe\Exception\CardException;
use Stripe\Exception\InvalidRequestException;
use Stripe\Exception\RateLimitException;
use Stripe\StripeClient;

class StripeConnectService
{
    private StripeClient $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('stripe.secret_key'));
    }

    /**
     * Create a Stripe Express account and persist the StripeConnectAccount record.
     * Schedules an onboarding-incomplete reminder for 3 days from now.
     */
    public function createConnectAccount(Organization $org, User $initiatedBy): StripeConnectAccount
    {
        $start = microtime(true);

        try {
            $stripeAccount = $this->stripe->accounts->create([
                'type'    => 'express',
                'country' => 'US',
                'email'   => $org->primary_contact_email,
                'capabilities' => [
                    'transfers' => ['requested' => true],
                ],
                'metadata' => [
                    'organization_id' => (string) $org->id,
                    'wayfield_env'    => app()->environment(),
                ],
            ]);
        } catch (\Throwable $e) {
            $this->logStripeCallDuration($start, 'accounts.create', false);
            throw $this->wrapStripeException($e);
        }

        $this->logStripeCallDuration($start, 'accounts.create', true);

        $account = StripeConnectAccount::create([
            'organization_id'   => $org->id,
            'stripe_account_id' => $stripeAccount->id,
            'onboarding_status' => 'initiated',
            'charges_enabled'   => false,
            'payouts_enabled'   => false,
            'details_submitted' => false,
            'country'           => 'US',
            'default_currency'  => 'usd',
        ]);

        // Schedule onboarding incomplete reminder for 3 days from now.
        ScheduledPaymentJob::create([
            'job_type'            => 'stripe_onboarding_incomplete_reminder',
            'notification_code'   => 'N-46',
            'related_entity_type' => 'stripe_connect_account',
            'related_entity_id'   => $account->id,
            'user_id'             => $initiatedBy->id,
            'scheduled_for'       => now()->addDays(3),
            'status'              => 'pending',
        ]);

        // N-44: In-app system notification to the initiating user.
        Notification::create([
            'organization_id'       => $org->id,
            'created_by_user_id'    => $initiatedBy->id,
            'title'                 => 'Stripe account connected — complete onboarding',
            'message'               => 'Your Stripe Express account has been created. Complete the onboarding process to start accepting payments.',
            'notification_type'     => 'informational',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'action_data'           => [
                'type'               => 'stripe_connect_onboarding',
                'stripe_account_id'  => $stripeAccount->id,
            ],
            'sent_at' => now(),
        ]);

        AuditLogService::record([
            'organization_id' => $org->id,
            'actor_user_id'   => $initiatedBy->id,
            'entity_type'     => 'stripe_connect_account',
            'entity_id'       => $account->id,
            'action'          => 'stripe_connect.onboarding_initiated',
            'metadata'        => [
                'stripe_account_id' => $stripeAccount->id,
            ],
        ]);

        return $account;
    }

    /**
     * Generate a fresh Stripe-hosted Express onboarding URL.
     * The returned URL expires in ~5 minutes — never cache it.
     */
    public function createAccountLink(
        StripeConnectAccount $account,
        string $returnUrl,
        string $refreshUrl,
    ): string {
        $start = microtime(true);

        try {
            $link = $this->stripe->accountLinks->create([
                'account'     => $account->stripe_account_id,
                'refresh_url' => $refreshUrl,
                'return_url'  => $returnUrl,
                'type'        => 'account_onboarding',
            ]);
        } catch (\Throwable $e) {
            $this->logStripeCallDuration($start, 'accountLinks.create', false);
            throw $this->wrapStripeException($e);
        }

        $this->logStripeCallDuration($start, 'accountLinks.create', true);

        return $link->url;
    }

    /**
     * Handle account.updated webhook.
     * Updates local mirror fields; marks onboarding complete when both capabilities are live.
     */
    public function handleAccountUpdatedWebhook(array $stripeEvent): void
    {
        $stripeAccountData = $stripeEvent['data']['object'] ?? [];
        $stripeAccountId   = $stripeAccountData['id'] ?? null;

        if (! $stripeAccountId) {
            Log::warning('StripeConnectService: account.updated missing account id');
            return;
        }

        $account = StripeConnectAccount::where('stripe_account_id', $stripeAccountId)->first();

        if (! $account) {
            Log::info('StripeConnectService: account.updated for unknown account', [
                'stripe_account_id' => $stripeAccountId,
            ]);
            return;
        }

        $wasComplete = $account->charges_enabled && $account->payouts_enabled;

        $account->update([
            'charges_enabled'          => (bool) ($stripeAccountData['charges_enabled'] ?? false),
            'payouts_enabled'          => (bool) ($stripeAccountData['payouts_enabled'] ?? false),
            'details_submitted'        => (bool) ($stripeAccountData['details_submitted'] ?? false),
            'capabilities_json'        => $stripeAccountData['capabilities'] ?? null,
            'requirements_json'        => $stripeAccountData['requirements'] ?? null,
            'onboarding_status'        => $this->deriveOnboardingStatus($stripeAccountData),
            'last_webhook_received_at' => now(),
        ]);

        $account->refresh();

        $nowComplete = $account->charges_enabled && $account->payouts_enabled;

        if (! $wasComplete && $nowComplete) {
            $account->update([
                'onboarding_status'       => 'complete',
                'onboarding_completed_at' => now(),
            ]);

            // Cancel the incomplete reminder job.
            ScheduledPaymentJob::query()
                ->forEntity('stripe_connect_account', $account->id)
                ->where('job_type', 'stripe_onboarding_incomplete_reminder')
                ->where('status', 'pending')
                ->each(fn (ScheduledPaymentJob $job) => $job->cancel('onboarding_completed'));

            // N-45: Email org owners/admins that onboarding is complete.
            $org = $account->organization;
            $this->notifyOrgAdmins($org, new StripeConnectOnboardingCompleteMail($org, $account));

            AuditLogService::record([
                'organization_id' => $account->organization_id,
                'entity_type'     => 'stripe_connect_account',
                'entity_id'       => $account->id,
                'action'          => 'stripe_connect.onboarding_completed',
                'metadata'        => [
                    'stripe_account_id' => $stripeAccountId,
                ],
            ]);
        }
    }

    /**
     * Handle account.application.deauthorized webhook.
     * Marks account deauthorized; queues urgent email to organizer.
     * Historical orders/registrations are never touched.
     */
    public function handleAccountDeauthorizedWebhook(array $stripeEvent): void
    {
        $stripeAccountId = $stripeEvent['data']['object']['id'] ?? null;

        if (! $stripeAccountId) {
            Log::warning('StripeConnectService: deauthorized webhook missing account id');
            return;
        }

        $account = StripeConnectAccount::where('stripe_account_id', $stripeAccountId)->first();

        if (! $account) {
            Log::info('StripeConnectService: deauthorized for unknown account', [
                'stripe_account_id' => $stripeAccountId,
            ]);
            return;
        }

        $account->update([
            'onboarding_status'        => 'deauthorized',
            'deauthorized_at'          => now(),
            'last_webhook_received_at' => now(),
        ]);

        $org = $account->organization;
        $this->notifyOrgAdmins($org, new StripeConnectDeauthorizedMail($org));

        AuditLogService::record([
            'organization_id' => $account->organization_id,
            'entity_type'     => 'stripe_connect_account',
            'entity_id'       => $account->id,
            'action'          => 'stripe_connect.account_deauthorized',
            'metadata'        => [
                'stripe_account_id' => $stripeAccountId,
            ],
        ]);
    }

    /**
     * Handle payout.failed webhook.
     * Logs the failure and queues N-41 email to organizer.
     */
    public function handlePayoutFailedWebhook(array $stripeEvent): void
    {
        $payout          = $stripeEvent['data']['object'] ?? [];
        $stripeAccountId = $stripeEvent['account'] ?? null;
        $failureMessage  = $payout['failure_message'] ?? 'Unknown payout failure';

        $account = $stripeAccountId
            ? StripeConnectAccount::where('stripe_account_id', $stripeAccountId)->first()
            : null;

        AuditLogService::record([
            'organization_id' => $account?->organization_id,
            'entity_type'     => 'stripe_connect_account',
            'entity_id'       => $account?->id,
            'action'          => 'stripe_connect.payout_failed',
            'metadata'        => [
                'stripe_account_id' => $stripeAccountId,
                'payout_id'         => $payout['id'] ?? null,
                'amount_cents'      => $payout['amount'] ?? null,
                'currency'          => $payout['currency'] ?? null,
                'failure_message'   => $failureMessage,
                'failure_code'      => $payout['failure_code'] ?? null,
            ],
        ]);

        if (! $account) {
            Log::warning('StripeConnectService: payout.failed for unknown account', [
                'stripe_account_id' => $stripeAccountId,
            ]);
            return;
        }

        $org = $account->organization;
        $this->notifyOrgAdmins($org, new StripeConnectPayoutFailedMail(
            organization:   $org,
            failureMessage: $failureMessage,
            amountCents:    $payout['amount'] ?? null,
            currency:       $payout['currency'] ?? null,
        ));
    }

    /**
     * Handle capability.updated webhook.
     * Queues N-43 email when any capability becomes inactive due to requirements.
     */
    public function handleCapabilityUpdatedWebhook(array $stripeEvent): void
    {
        $capability      = $stripeEvent['data']['object'] ?? [];
        $stripeAccountId = $capability['account'] ?? null;
        $capabilityId    = $capability['id'] ?? 'unknown';
        $newStatus       = $capability['status'] ?? null;

        if ($newStatus !== 'inactive') {
            return;
        }

        // Only alert if requirements are the cause (not a voluntary disable).
        $requirements = $capability['requirements'] ?? [];
        if (empty($requirements['currently_due']) && empty($requirements['past_due'])) {
            return;
        }

        $account = $stripeAccountId
            ? StripeConnectAccount::where('stripe_account_id', $stripeAccountId)->first()
            : null;

        AuditLogService::record([
            'organization_id' => $account?->organization_id,
            'entity_type'     => 'stripe_connect_account',
            'entity_id'       => $account?->id,
            'action'          => 'stripe_connect.verification_required',
            'metadata'        => [
                'stripe_account_id' => $stripeAccountId,
                'capability_id'     => $capabilityId,
                'status'            => $newStatus,
            ],
        ]);

        if (! $account) {
            Log::warning('StripeConnectService: capability.updated for unknown account', [
                'stripe_account_id' => $stripeAccountId,
            ]);
            return;
        }

        $org = $account->organization;
        $this->notifyOrgAdmins($org, new StripeConnectVerificationRequiredMail($org, $capabilityId));
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send a mailable to all active owner/admin users of the organization.
     */
    private function notifyOrgAdmins(Organization $org, \Illuminate\Mail\Mailable $mailable): void
    {
        $recipients = $org->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->wherePivot('is_active', true)
            ->get();

        foreach ($recipients as $user) {
            Mail::to($user->email)->queue(clone $mailable);
        }
    }

    /**
     * Derive the onboarding_status enum value from a Stripe account object.
     * Does not return 'complete' — that transition is handled explicitly in
     * handleAccountUpdatedWebhook after checking the full state change.
     */
    private function deriveOnboardingStatus(array $stripeAccount): string
    {
        if (($stripeAccount['requirements']['disabled_reason'] ?? null) !== null) {
            return 'restricted';
        }

        if ($stripeAccount['details_submitted'] ?? false) {
            return 'pending';
        }

        return 'initiated';
    }

    /**
     * Wrap a raw Stripe exception in a standardized exception with HTTP context.
     */
    private function wrapStripeException(\Throwable $e): \Throwable
    {
        if ($e instanceof RateLimitException) {
            return new \RuntimeException('Stripe rate limit exceeded. Please retry shortly.', 429, $e);
        }

        if ($e instanceof ApiConnectionException) {
            return new \RuntimeException('Could not connect to Stripe. Please try again.', 503, $e);
        }

        if ($e instanceof AuthenticationException) {
            Log::critical('Stripe authentication failed — check STRIPE_SECRET_KEY configuration', [
                'message' => $e->getMessage(),
            ]);
            return new \RuntimeException('Payment service configuration error.', 500, $e);
        }

        if ($e instanceof InvalidRequestException) {
            return new \RuntimeException('Invalid Stripe request: '.$e->getMessage(), 422, $e);
        }

        if ($e instanceof CardException) {
            return new \RuntimeException($e->getMessage(), 402, $e);
        }

        return $e;
    }

    private function logStripeCallDuration(float $start, string $method, bool $success): void
    {
        Log::info('Stripe API call', [
            'method'        => $method,
            'duration_ms'   => round((microtime(true) - $start) * 1000, 2),
            'success'       => $success,
        ]);
    }
}
