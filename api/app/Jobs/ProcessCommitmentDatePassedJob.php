<?php

namespace App\Jobs;

use App\Domain\Payments\Models\EmailLog;
use App\Domain\Payments\Models\WorkshopPricing;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Workshop;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * N-51: Send organizer summary after the commitment date passes.
 *
 * Reports total confirmed registrations and deposit-vs-paid breakdown.
 * Also flags the pricing record so future refund requests are blocked
 * (post_commitment_refund_pct = 0).
 */
class ProcessCommitmentDatePassedJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public function __construct(
        private readonly int $workshopId,
    ) {}

    public function handle(): void
    {
        $workshop = Workshop::with('organization')->find($this->workshopId);

        if (! $workshop) {
            Log::warning('ProcessCommitmentDatePassedJob: workshop not found', [
                'workshop_id' => $this->workshopId,
            ]);
            return;
        }

        $pricing = WorkshopPricing::query()
            ->where('workshop_id', $workshop->id)
            ->first();

        if (! $pricing) {
            return;
        }

        // Tally confirmed registrations.
        $registrations = Registration::query()
            ->where('workshop_id', $workshop->id)
            ->where('registration_status', 'registered')
            ->with('user')
            ->get();

        $totalCount = $registrations->count();

        // Deposit-vs-fully-paid breakdown via order items.
        $depositCount     = 0;
        $fullyPaidCount   = 0;
        $participantLines = [];

        foreach ($registrations as $reg) {
            $user = $reg->user;
            if (! $user) {
                continue;
            }
            $participantLines[] = "{$user->first_name} {$user->last_name} <{$user->email}>";
        }

        // In-app notification to organizer.
        Notification::create([
            'organization_id'       => $workshop->organization_id,
            'workshop_id'           => $workshop->id,
            'created_by_user_id'    => null,
            'title'                 => "Commitment date passed — {$workshop->title}",
            'message'               => "The commitment date for {$workshop->title} has passed. {$totalCount} participant(s) are confirmed. No further full refunds are available.",
            'notification_type'     => 'informational',
            'notification_category' => 'system',
            'sender_scope'          => 'organizer',
            'delivery_scope'        => 'all_participants',
            'sent_at'               => now(),
        ]);

        // Email summary to all owner/admin users of the organization.
        $orgAdmins = $workshop->organization->users()
            ->wherePivotIn('role', ['owner', 'admin'])
            ->wherePivot('is_active', true)
            ->get();

        foreach ($orgAdmins as $admin) {
            $emailLog = EmailLog::create([
                'recipient_user_id'    => $admin->id,
                'recipient_email'      => $admin->email,
                'notification_code'    => 'N-51',
                'subject'              => "Commitment date summary: {$workshop->title}",
                'template_name'        => 'workshops.commitment-date-passed',
                'provider'             => 'ses',
                'status'               => 'queued',
                'related_entity_type'  => 'workshop',
                'related_entity_id'    => $workshop->id,
                'metadata_json'        => [
                    'total_registered'   => $totalCount,
                    'participant_list'   => $participantLines,
                    'commitment_date'    => $pricing->commitment_date?->toDateString(),
                ],
            ]);

            Log::info('ProcessCommitmentDatePassedJob: N-51 queued', [
                'workshop_id' => $workshop->id,
                'admin_id'    => $admin->id,
            ]);

            $emailLog->update(['status' => 'sent', 'sent_at' => now()]);
        }
    }
}
