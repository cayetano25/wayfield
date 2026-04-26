<?php

namespace App\Jobs;

use App\Domain\Payments\Models\Dispute;
use App\Domain\Payments\Models\EmailLog;
use App\Mail\Payments\DisputeEvidenceReminderMail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * N-36: Urgent reminder to organizer that dispute evidence is due soon.
 *
 * Sent 3 days before evidence_due_by. Includes dispute amount, reason,
 * days remaining, and a direct link to the Stripe dispute dashboard.
 */
class SendDisputeEvidenceReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $disputeId,
    ) {}

    public function handle(): void
    {
        $dispute = Dispute::with('order.organization')->find($this->disputeId);

        if (! $dispute) {
            Log::warning('SendDisputeEvidenceReminderJob: dispute not found', [
                'dispute_id' => $this->disputeId,
            ]);
            return;
        }

        // Skip if dispute was already resolved.
        if (in_array($dispute->status, ['won', 'lost', 'charge_refunded'], true)) {
            return;
        }

        $order = $dispute->order;

        if (! $order) {
            return;
        }

        $org = $order->organization;

        if (! $org) {
            return;
        }

        $evidenceDueBy    = $dispute->evidence_due_by;
        $daysRemaining    = $evidenceDueBy ? (int) max(0, now()->diffInDays($evidenceDueBy, false)) : null;
        $dueDate          = $evidenceDueBy?->toFormattedDateString() ?? 'unknown';
        $amountFormatted  = '$' . number_format($dispute->amount_cents / 100, 2);
        $stripeDashboard  = "https://dashboard.stripe.com/disputes/{$dispute->stripe_dispute_id}";

        $subject = "Action required by {$dueDate}: Dispute evidence needed for {$amountFormatted}";

        $orgAdmins = $org->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->wherePivot('is_active', true)
            ->get();

        foreach ($orgAdmins as $admin) {
            $emailLog = EmailLog::create([
                'recipient_user_id'    => $admin->id,
                'recipient_email'      => $admin->email,
                'notification_code'    => 'N-36',
                'subject'              => $subject,
                'template_name'        => 'payments.dispute-evidence-reminder',
                'provider'             => 'ses',
                'status'               => 'queued',
                'related_entity_type'  => 'dispute',
                'related_entity_id'    => $dispute->id,
                'metadata_json'        => [
                    'dispute_id'       => $dispute->id,
                    'amount_formatted' => $amountFormatted,
                    'reason'           => $dispute->reason,
                    'evidence_due_by'  => $evidenceDueBy?->toIso8601String(),
                    'days_remaining'   => $daysRemaining,
                    'stripe_url'       => $stripeDashboard,
                    'order_number'     => $order->order_number,
                ],
            ]);

            Mail::to($admin->email)->queue(
                new DisputeEvidenceReminderMail($dispute, $order, $admin, (int) $daysRemaining),
            );

            Log::info('SendDisputeEvidenceReminderJob: N-36 sent', [
                'dispute_id'     => $dispute->id,
                'admin_id'       => $admin->id,
                'days_remaining' => $daysRemaining,
            ]);

            $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
        }
    }
}
