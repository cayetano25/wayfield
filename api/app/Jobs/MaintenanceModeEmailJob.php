<?php

namespace App\Jobs;

use App\Mail\MaintenanceModeMail;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class MaintenanceModeEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly string $message,
        public readonly ?string $startsAt,
        public readonly ?string $endsAt,
    ) {}

    public function handle(): void
    {
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
                Mail::to($user->email)->queue(
                    new MaintenanceModeMail($user, $this->message, $this->startsAt, $this->endsAt)
                );
            }
        }
    }
}
