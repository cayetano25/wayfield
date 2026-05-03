<?php

namespace App\Jobs;

use App\Mail\SystemAnnouncementMail;
use App\Models\SystemAnnouncement;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class BroadcastAnnouncementEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $announcementId) {}

    public function handle(): void
    {
        $announcement = SystemAnnouncement::find($this->announcementId);

        if (! $announcement || ! $announcement->is_active) {
            return;
        }

        // One email per unique user — owners and admins only (staff and billing_admin excluded).
        $userIds = DB::table('organization_users')
            ->whereIn('role', ['owner', 'admin'])
            ->join('users', 'users.id', '=', 'organization_users.user_id')
            ->where('users.is_active', true)
            ->whereNotNull('users.email_verified_at')
            ->distinct()
            ->pluck('organization_users.user_id');

        foreach ($userIds->chunk(100) as $chunk) {
            foreach ($chunk as $userId) {
                $user = User::find($userId);
                if (! $user) {
                    continue;
                }
                Mail::to($user->email)->queue(new SystemAnnouncementMail($user, $announcement));
            }
        }
    }
}
