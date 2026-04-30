<?php

declare(strict_types=1);

namespace App\Domain\Payments\Services;

use App\Domain\Payments\Models\PaymentIntentRecord;
use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Domain\Payments\Models\StripeConnectAccount;
use App\Domain\Payments\Models\WaitlistPromotionPayment;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Domain\Shared\Services\AuditLogService;
use App\Models\Registration;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WaitlistPromotionService
{
    public function __construct(
        private readonly FeeCalculationService $feeCalculationService,
    ) {}

    /**
     * Promote the next waitlisted participant to active status.
     *
     * Called when a spot opens (cancellation, balance expiry) or when an
     * organizer manually promotes someone. For paid workshops a 48-hour
     * payment window is opened; for free workshops registration is immediate.
     */
    public function promoteNextFromWaitlist(Workshop $workshop): ?WaitlistPromotionPayment
    {
        // Step 1: Find the oldest waitlisted registration.
        $registration = Registration::query()
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'waitlisted')
            ->orderBy('registered_at', 'asc')
            ->first();

        if (! $registration) {
            // N-18: waitlist exhausted — in-app to organizer.
            \App\Jobs\SendWaitlistExhaustedJob::dispatch($workshop->id);
            return null;
        }

        // Step 2: Check whether this is a free workshop.
        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        if (! $pricing || (int) $pricing->base_price_cents === 0) {
            // Free workshop: promote directly without a payment window.
            DB::transaction(function () use ($registration) {
                $registration->update(['registration_status' => 'registered']);
            });

            // N-15: email to participant; N-16: in-app to organizer.
            \App\Jobs\SendWaitlistRegisteredFreeJob::dispatch($registration->id);

            return null;
        }

        // Step 3: Paid workshop — open a 48-hour payment window.
        $windowOpened  = Carbon::now();
        $windowExpires = $windowOpened->copy()->addHours(48);

        $promotionPayment = WaitlistPromotionPayment::create([
            'user_id'              => $registration->user_id,
            'workshop_id'          => $workshop->id,
            'waitlist_entry_id'    => $registration->id,
            'status'               => 'window_open',
            'payment_window_hours' => 48,
            'window_opened_at'     => $windowOpened,
            'window_expires_at'    => $windowExpires,
        ]);

        // Step 4: Schedule expiry job and 24-hour reminder.
        ScheduledPaymentJob::create([
            'job_type'            => 'waitlist_window_expiry',
            'related_entity_type' => 'waitlist_promotion_payment',
            'related_entity_id'   => $promotionPayment->id,
            'user_id'             => $registration->user_id,
            'scheduled_for'       => $windowExpires,
            'status'              => 'pending',
            'max_attempts'        => 3,
        ]);

        ScheduledPaymentJob::create([
            'job_type'            => 'waitlist_window_reminder',
            'notification_code'   => 'N-14',
            'related_entity_type' => 'waitlist_promotion_payment',
            'related_entity_id'   => $promotionPayment->id,
            'user_id'             => $registration->user_id,
            'scheduled_for'       => $windowOpened->copy()->addHours(24),
            'status'              => 'pending',
            'max_attempts'        => 3,
        ]);

        // Step 5: N-13 — email participant (promoted, 48 hours to pay).
        \App\Jobs\SendWaitlistPromotedPaidJob::dispatch($promotionPayment->id);

        // Step 6: Audit log.
        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id'   => null,
            'entity_type'     => 'waitlist_promotion_payment',
            'entity_id'       => $promotionPayment->id,
            'action'          => 'waitlist.participant_promoted',
            'metadata'        => [
                'workshop_id'    => $workshop->id,
                'user_id'        => $registration->user_id,
                'window_expires' => $windowExpires->toIso8601String(),
            ],
        ]);

        return $promotionPayment;
    }

    /**
     * Handle expiry of a waitlist payment window.
     *
     * Called by ProcessWaitlistWindowExpiryJob when the 48-hour window closes
     * without a completed payment. Marks the promotion as skipped and promotes
     * the next person in line.
     */
    public function processWaitlistWindowExpiry(WaitlistPromotionPayment $promotionPayment): void
    {
        // Idempotency: already paid during the window.
        if ($promotionPayment->payment_completed_at !== null) {
            ScheduledPaymentJob::query()
                ->forEntity('waitlist_promotion_payment', $promotionPayment->id)
                ->where('status', 'pending')
                ->get()
                ->each(fn ($job) => $job->cancel('already_paid'));
            return;
        }

        DB::transaction(function () use ($promotionPayment) {
            $promotionPayment->update([
                'status'     => 'skipped',
                'skipped_at' => now(),
            ]);

            AuditLogService::record([
                'organization_id' => $promotionPayment->workshop->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'waitlist_promotion_payment',
                'entity_id'       => $promotionPayment->id,
                'action'          => 'waitlist.payment_window_expired',
                'metadata'        => [
                    'workshop_id' => $promotionPayment->workshop_id,
                    'user_id'     => $promotionPayment->user_id,
                ],
            ]);

            AuditLogService::record([
                'organization_id' => $promotionPayment->workshop->organization_id,
                'actor_user_id'   => null,
                'entity_type'     => 'waitlist_promotion_payment',
                'entity_id'       => $promotionPayment->id,
                'action'          => 'waitlist.participant_skipped',
                'metadata'        => [
                    'workshop_id' => $promotionPayment->workshop_id,
                    'user_id'     => $promotionPayment->user_id,
                ],
            ]);
        });

        // N-17: notify skipped participant.
        \App\Jobs\SendWaitlistSkippedJob::dispatch($promotionPayment->id);

        // Cascade: promote the next person in line.
        $promotionPayment->loadMissing('workshop');
        $this->promoteNextFromWaitlist($promotionPayment->workshop);
    }

    /**
     * Prepare a Stripe PaymentIntent for a waitlist payment window.
     *
     * Called from WaitlistPaymentController. Reuses an existing pending intent
     * if one exists, otherwise creates a new one.
     */
    public function prepareWaitlistPaymentIntent(WaitlistPromotionPayment $promotionPayment): array
    {
        $workshop = $promotionPayment->workshop->loadMissing('organization');
        $pricing  = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->firstOrFail();

        $connectAccount = StripeConnectAccount::query()
            ->where('organization_id', $workshop->organization_id)
            ->first();

        if (! $connectAccount || ! $connectAccount->charges_enabled) {
            throw new \RuntimeException('Stripe Connect not ready for this organization.');
        }

        $stripeAccountId = $connectAccount->stripe_account_id;
        $stripe          = new \Stripe\StripeClient(config('stripe.secret_key'));

        // Reuse an existing pending intent to prevent duplicate records.
        $existing = PaymentIntentRecord::query()
            ->where('order_id', null)
            ->whereIn('status', ['requires_payment_method', 'requires_confirmation', 'requires_action'])
            ->where('stripe_account_id', $stripeAccountId)
            ->whereJsonContains('metadata_json->waitlist_promotion_payment_id', $promotionPayment->id)
            ->latest()
            ->first();

        if ($existing) {
            try {
                $stripeIntent = $stripe->paymentIntents->retrieve(
                    $existing->stripe_payment_intent_id,
                );

                if (in_array($stripeIntent->status, ['requires_payment_method', 'requires_confirmation', 'requires_action'], true)) {
                    return $this->buildIntentResponse($stripeIntent->client_secret, $pricing, $promotionPayment);
                }
            } catch (\Throwable $e) {
                Log::warning('WaitlistPromotionService: failed to retrieve existing intent', [
                    'promotion_payment_id' => $promotionPayment->id,
                    'error'                => $e->getMessage(),
                ]);
            }
        }

        $org      = $workshop->organization;
        $planCode = $org->activeSubscription?->plan_code ?? 'free';
        $fees     = $this->feeCalculationService->calculateFees(
            (int) $pricing->base_price_cents,
            $planCode,
            $pricing->currency,
        );

        $intent = $stripe->paymentIntents->create([
            'amount'                    => (int) $pricing->base_price_cents,
            'currency'                  => $pricing->currency,
            'automatic_payment_methods' => ['enabled' => true],
            'application_fee_amount'    => $fees->wayFieldFeeCents,
            'transfer_data'             => ['destination' => $stripeAccountId],
            'metadata'                  => [
                'waitlist_promotion_payment_id' => $promotionPayment->id,
                'workshop_id'                   => $workshop->id,
                'intent_type'                   => 'waitlist',
            ],
        ]);

        PaymentIntentRecord::create([
            'order_id'                 => null,
            'intent_type'              => 'waitlist',
            'stripe_payment_intent_id' => $intent->id,
            'stripe_account_id'        => $stripeAccountId,
            'amount_cents'             => (int) $pricing->base_price_cents,
            'currency'                 => $pricing->currency,
            'application_fee_cents'    => $fees->wayFieldFeeCents,
            'status'                   => 'requires_payment_method',
            'stripe_status'            => $intent->status,
            'metadata_json'            => ['waitlist_promotion_payment_id' => $promotionPayment->id],
        ]);

        return $this->buildIntentResponse($intent->client_secret, $pricing, $promotionPayment);
    }

    private function buildIntentResponse(
        string $clientSecret,
        WorkshopPricing $pricing,
        WaitlistPromotionPayment $promotionPayment,
    ): array {
        $workshop = $promotionPayment->workshop;

        return [
            'client_secret'          => $clientSecret,
            'stripe_publishable_key' => config('stripe.publishable_key'),
            'amount_cents'           => (int) $pricing->base_price_cents,
            'formatted_amount'       => '$' . number_format($pricing->base_price_cents / 100, 2),
            'window_expires_at'      => $promotionPayment->window_expires_at->toIso8601String(),
            'workshop_title'         => $workshop?->title,
            'workshop_slug'          => $workshop?->public_slug,
        ];
    }
}
