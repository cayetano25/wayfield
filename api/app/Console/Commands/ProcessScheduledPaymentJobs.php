<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Payments\Models\ScheduledPaymentJob;
use App\Jobs\ProcessBalanceChargeJob;
use App\Jobs\ProcessBalancePaymentExpiryJob;
use App\Jobs\ProcessCommitmentDatePassedJob;
use App\Jobs\ProcessMinimumAttendanceCheckJob;
use App\Jobs\ProcessWaitlistWindowExpiryJob;
use App\Jobs\SendBalanceReminderEmailJob;
use App\Jobs\SendCommitmentDateReminderJob;
use App\Jobs\SendDisputeEvidenceReminderJob;
use App\Jobs\SendOnboardingIncompleteReminderJob;
use App\Jobs\SendPreSessionJoinLinkJob;
use App\Jobs\SendPreWorkshopReminderJob;
use App\Jobs\SendWaitlistWindowReminderJob;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Picks up due ScheduledPaymentJob rows and dispatches the corresponding
 * queued job class. Runs every 5 minutes via routes/console.php.
 *
 * Supports:
 *   balance_charge               → ProcessBalanceChargeJob
 *   balance_reminder             → SendBalanceReminderEmailJob
 *   balance_payment_expiry       → ProcessBalancePaymentExpiryJob
 *   commitment_date_reminder     → SendCommitmentDateReminderJob (TODO)
 *   commitment_date_passed       → ProcessCommitmentDatePassedJob (TODO)
 *   waitlist_window_expiry       → ProcessWaitlistWindowExpiryJob (TODO)
 *   waitlist_window_reminder     → SendWaitlistReminderEmailJob (TODO)
 *   pre_workshop_7day            → SendPreWorkshopReminderJob (TODO)
 *   pre_workshop_24hour          → SendPreWorkshopReminderJob (TODO)
 *   pre_session_1hour            → SendPreSessionJoinLinkJob (TODO)
 *   dispute_evidence_reminder    → SendDisputeEvidenceReminderJob (TODO)
 *   stripe_onboarding_*          → SendOnboardingIncompleteReminderJob (TODO)
 *   cart_expiry                  → ProcessCartExpiryJob (TODO)
 *   minimum_attendance_check     → ProcessMinimumAttendanceCheckJob (TODO)
 */
class ProcessScheduledPaymentJobs extends Command
{
    protected $signature   = 'payments:process-scheduled-jobs
                              {--limit=50 : Maximum jobs to process per run}
                              {--dry-run  : Preview due jobs without dispatching}';

    protected $description = 'Process due scheduled payment jobs (runs every 5 minutes)';

    /** Exponential back-off delays in minutes: attempt 1=15m, 2=60m, 3=240m. */
    private const BACKOFF_MINUTES = [15, 60, 240];

    public function handle(): int
    {
        $limit  = (int) $this->option('limit');
        $dryRun = (bool) $this->option('dry-run');

        $jobs = ScheduledPaymentJob::query()
            ->where('status', 'pending')
            ->where('scheduled_for', '<=', now())
            ->orderBy('scheduled_for')
            ->limit($limit)
            ->get();

        if ($jobs->isEmpty()) {
            return self::SUCCESS;
        }

        $this->info("Found {$jobs->count()} due job(s).");

        if ($dryRun) {
            foreach ($jobs as $job) {
                $this->line("  [{$job->id}] {$job->job_type} — entity {$job->related_entity_type}#{$job->related_entity_id}");
            }
            $this->info('[dry-run] No jobs dispatched.');
            return self::SUCCESS;
        }

        $dispatched = 0;
        $failed     = 0;

        foreach ($jobs as $scheduledJob) {
            $job = $scheduledJob; // avoid variable capture confusion in closures

            $job->update([
                'status'           => 'processing',
                'last_attempted_at' => now(),
                'attempts'         => $job->attempts + 1,
            ]);

            try {
                $this->dispatch($job);

                $job->update([
                    'status'       => 'completed',
                    'completed_at' => now(),
                ]);
                $dispatched++;

            } catch (Throwable $e) {
                Log::error('ProcessScheduledPaymentJobs: job dispatch failed', [
                    'scheduled_job_id'    => $job->id,
                    'job_type'            => $job->job_type,
                    'related_entity_type' => $job->related_entity_type,
                    'related_entity_id'   => $job->related_entity_id,
                    'attempt'             => $job->attempts,
                    'error'               => $e->getMessage(),
                ]);

                if ($job->attempts >= $job->max_attempts) {
                    $job->update([
                        'status'         => 'failed',
                        'result_message' => $e->getMessage(),
                    ]);
                } else {
                    $backoffMinutes = self::BACKOFF_MINUTES[$job->attempts - 1] ?? 240;
                    $job->update([
                        'status'        => 'pending',
                        'scheduled_for' => Carbon::now()->addMinutes($backoffMinutes),
                        'result_message' => $e->getMessage(),
                    ]);
                }
                $failed++;
            }
        }

        $this->info("Dispatched: {$dispatched}  Failed: {$failed}");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Route the ScheduledPaymentJob to its queued job class.
     *
     * Jobs that are not yet implemented log a warning and complete silently
     * so they do not block the runner.
     */
    private function dispatch(ScheduledPaymentJob $job): void
    {
        $entityId = (int) $job->related_entity_id;

        match ($job->job_type) {
            'balance_charge'
                => ProcessBalanceChargeJob::dispatch($entityId),

            'balance_reminder'
                => SendBalanceReminderEmailJob::dispatch($entityId, (string) $job->notification_code),

            'balance_payment_expiry'
                => ProcessBalancePaymentExpiryJob::dispatch($entityId),

            'waitlist_window_expiry'
                => ProcessWaitlistWindowExpiryJob::dispatch($entityId),

            'waitlist_window_reminder'
                => SendWaitlistWindowReminderJob::dispatch($entityId),

            'pre_workshop_7day'
                => SendPreWorkshopReminderJob::dispatch($entityId, 'N-19'),

            'pre_workshop_24hour'
                => SendPreWorkshopReminderJob::dispatch($entityId, 'N-20'),

            'pre_session_1hour'
                => SendPreSessionJoinLinkJob::dispatch($entityId),

            'commitment_date_reminder'
                => SendCommitmentDateReminderJob::dispatch($entityId, (string) $job->notification_code),

            'commitment_date_passed'
                => ProcessCommitmentDatePassedJob::dispatch($entityId),

            'minimum_attendance_check'
                => ProcessMinimumAttendanceCheckJob::dispatch($entityId),

            'dispute_evidence_reminder'
                => SendDisputeEvidenceReminderJob::dispatch($entityId),

            'stripe_onboarding_incomplete_reminder'
                => SendOnboardingIncompleteReminderJob::dispatch($entityId),

            default => $this->warnUnimplemented($job),
        };
    }

    private function warnUnimplemented(ScheduledPaymentJob $job): void
    {
        Log::warning('ProcessScheduledPaymentJobs: unimplemented job_type — completing silently', [
            'job_type'            => $job->job_type,
            'scheduled_job_id'    => $job->id,
            'related_entity_type' => $job->related_entity_type,
            'related_entity_id'   => $job->related_entity_id,
        ]);
    }
}
