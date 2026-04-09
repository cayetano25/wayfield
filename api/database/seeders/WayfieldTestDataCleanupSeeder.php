<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class WayfieldTestDataCleanupSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Cleaning up Wayfield test data...');

        $testEmails = [
            'owner@wayfield.test',
            'admin@wayfield.test',
            'participant1@wayfield.test',
            'participant2@wayfield.test',
            'participant3@wayfield.test',
            'leader@wayfield.test',
        ];

        $userIds = DB::table('users')
            ->whereIn('email', $testEmails)
            ->pluck('id');

        // Remove in reverse dependency order
        DB::table('attendance_records')->whereIn('user_id', $userIds)->delete();

        $regIds = DB::table('registrations')->whereIn('user_id', $userIds)->pluck('id');
        DB::table('session_selections')->whereIn('registration_id', $regIds)->delete();
        DB::table('registrations')->whereIn('id', $regIds)->delete();

        $leaderIds = DB::table('leaders')->whereIn('user_id', $userIds)->pluck('id');
        DB::table('session_leaders')->whereIn('leader_id', $leaderIds)->delete();
        DB::table('workshop_leaders')->whereIn('leader_id', $leaderIds)->delete();
        DB::table('organization_leaders')->whereIn('leader_id', $leaderIds)->delete();
        DB::table('leader_invitations')->whereIn('leader_id', $leaderIds)->delete();
        DB::table('leaders')->whereIn('id', $leaderIds)->delete();

        $orgIds = DB::table('organization_users')
            ->whereIn('user_id', $userIds)
            ->where('role', 'owner')
            ->pluck('organization_id');

        // Get workshop IDs for these orgs
        $workshopIds = DB::table('workshops')
            ->whereIn('organization_id', $orgIds)
            ->pluck('id');

        $sessionIds = DB::table('sessions')
            ->whereIn('workshop_id', $workshopIds)
            ->pluck('id');

        DB::table('session_leaders')->whereIn('session_id', $sessionIds)->delete();
        DB::table('tracks')->whereIn('workshop_id', $workshopIds)->delete();
        DB::table('sessions')->whereIn('id', $sessionIds)->delete();
        DB::table('workshop_logistics')->whereIn('workshop_id', $workshopIds)->delete();
        DB::table('workshop_leaders')->whereIn('workshop_id', $workshopIds)->delete();
        DB::table('workshops')->whereIn('id', $workshopIds)->delete();
        DB::table('subscriptions')->whereIn('organization_id', $orgIds)->delete();
        DB::table('organization_users')->whereIn('organization_id', $orgIds)->delete();
        DB::table('organizations')->whereIn('id', $orgIds)->delete();

        DB::table('auth_methods')->whereIn('user_id', $userIds)->delete();
        DB::table('user_sessions')->whereIn('user_id', $userIds)->delete();
        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\User')
            ->whereIn('tokenable_id', $userIds)
            ->delete();
        DB::table('users')->whereIn('id', $userIds)->delete();

        $this->command->info('✓ All test data removed');
    }
}
