<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AttendanceRecord;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\SessionSelection;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class E2ETestSeeder extends Seeder
{
    public function run(): void
    {
        if (!app()->environment(['testing', 'local'])) {
            $this->command?->error('E2ETestSeeder can only run in testing or local environments.');
            return;
        }

        // ── Users ──────────────────────────────────────────────────────

        $users = [
            'owner'        => $this->upsertUser('owner@e2e.wayfield.test', 'Alex', 'Rivera'),
            'admin'        => $this->upsertUser('admin@e2e.wayfield.test', 'Jordan', 'Alvarez'),
            'staff'        => $this->upsertUser('staff@e2e.wayfield.test', 'Sam', 'Chen'),
            'leader'       => $this->upsertUser('leader@e2e.wayfield.test', 'Sarah', 'Kim'),
            'participant'  => $this->upsertUser('participant@e2e.wayfield.test', 'Maria', 'Santos'),
            'participant2' => $this->upsertUser('participant2@e2e.wayfield.test', 'James', 'Park'),
        ];

        // ── Organization ───────────────────────────────────────────────

        $org = Organization::firstOrCreate(
            ['slug' => 'cascade-photo'],
            [
                'name'                       => 'Cascade Photography',
                'primary_contact_first_name' => 'Alex',
                'primary_contact_last_name'  => 'Rivera',
                'primary_contact_email'      => 'owner@e2e.wayfield.test',
                'status'                     => 'active',
            ]
        );

        // Memberships
        OrganizationUser::firstOrCreate(
            ['organization_id' => $org->id, 'user_id' => $users['owner']->id],
            ['role' => 'owner', 'is_active' => true]
        );
        OrganizationUser::firstOrCreate(
            ['organization_id' => $org->id, 'user_id' => $users['admin']->id],
            ['role' => 'admin', 'is_active' => true]
        );
        OrganizationUser::firstOrCreate(
            ['organization_id' => $org->id, 'user_id' => $users['staff']->id],
            ['role' => 'staff', 'is_active' => true]
        );

        // Subscription (Starter plan)
        Subscription::firstOrCreate(
            ['organization_id' => $org->id],
            [
                'plan_code' => 'starter',
                'status'    => 'active',
                'starts_at' => now(),
            ]
        );

        // ── Workshop ───────────────────────────────────────────────────

        $workshopStart = Carbon::now()->addDays(30)->startOfDay();
        $workshop = Workshop::firstOrCreate(
            ['join_code' => 'MEADOW2025'],
            [
                'organization_id'     => $org->id,
                'workshop_type'       => 'session_based',
                'title'               => 'Natural Light & Portraiture 2025',
                'description'         => 'Master natural light photography in the field.',
                'status'              => 'published',
                'timezone'            => 'America/Chicago',
                'start_date'          => $workshopStart->toDateString(),
                'end_date'            => $workshopStart->copy()->addDays(3)->toDateString(),
                'public_page_enabled' => true,
                'public_slug'         => 'cascade-photo-nlp2025',
            ]
        );

        // ── Sessions ───────────────────────────────────────────────────

        $day1 = Carbon::parse($workshop->start_date, 'America/Chicago');

        // Session A: Wildlife at Dawn — capacity 20, starts 8 AM day 1
        $sessionA = Session::firstOrCreate(
            ['workshop_id' => $workshop->id, 'title' => 'Wildlife at Dawn'],
            [
                'start_at'      => $day1->copy()->setTime(8, 0)->utc(),
                'end_at'        => $day1->copy()->setTime(10, 0)->utc(),
                'delivery_type' => 'in_person',
                'capacity'      => 20,
                'is_published'  => true,
            ]
        );

        // Session B: Golden Hour — capacity 15, starts 2 PM day 1
        $sessionB = Session::firstOrCreate(
            ['workshop_id' => $workshop->id, 'title' => 'Golden Hour Composition'],
            [
                'start_at'      => $day1->copy()->setTime(14, 0)->utc(),
                'end_at'        => $day1->copy()->setTime(16, 0)->utc(),
                'delivery_type' => 'in_person',
                'capacity'      => 15,
                'is_published'  => true,
            ]
        );

        // Session C: Composition Theory — OVERLAPS Session B (2 PM – 5 PM)
        $sessionC = Session::firstOrCreate(
            ['workshop_id' => $workshop->id, 'title' => 'Composition Theory'],
            [
                'start_at'      => $day1->copy()->setTime(14, 0)->utc(),
                'end_at'        => $day1->copy()->setTime(17, 0)->utc(),
                'delivery_type' => 'in_person',
                'capacity'      => 10,
                'is_published'  => true,
            ]
        );

        // Session D: Post-Processing — unlimited capacity, day 2
        $day2 = $day1->copy()->addDay();
        $sessionD = Session::firstOrCreate(
            ['workshop_id' => $workshop->id, 'title' => 'Post-Processing Workshop'],
            [
                'start_at'      => $day2->copy()->setTime(9, 0)->utc(),
                'end_at'        => $day2->copy()->setTime(11, 0)->utc(),
                'delivery_type' => 'in_person',
                'capacity'      => null, // unlimited — see DEC-010
                'is_published'  => true,
            ]
        );

        // ── Leader ─────────────────────────────────────────────────────

        $leader = Leader::firstOrCreate(
            ['user_id' => $users['leader']->id],
            [
                'first_name'      => 'Sarah',
                'last_name'       => 'Kim',
                'email'           => 'leader@e2e.wayfield.test',
                'phone_number'    => '555-867-5309',
                'bio'             => 'Award-winning portrait photographer.',
                'city'            => 'Portland',
                'state_or_region' => 'OR',
            ]
        );

        // Accepted invitation
        LeaderInvitation::firstOrCreate(
            ['organization_id' => $org->id, 'leader_id' => $leader->id],
            [
                'invited_email'         => 'leader@e2e.wayfield.test',
                'status'                => 'accepted',
                'invitation_token_hash' => hash('sha256', 'e2e-leader-accepted-token'),
                'expires_at'            => now()->addDays(7),
                'created_by_user_id'    => $users['owner']->id,
                'responded_at'          => now(),
                'workshop_id'           => $workshop->id,
            ]
        );

        // Assign leader to sessions A and B
        SessionLeader::firstOrCreate(
            ['session_id' => $sessionA->id, 'leader_id' => $leader->id],
            ['assignment_status' => 'accepted']
        );
        SessionLeader::firstOrCreate(
            ['session_id' => $sessionB->id, 'leader_id' => $leader->id],
            ['assignment_status' => 'accepted']
        );

        // ── Participant registrations ───────────────────────────────────

        $reg1 = Registration::firstOrCreate(
            ['workshop_id' => $workshop->id, 'user_id' => $users['participant']->id],
            [
                'registration_status' => 'registered',
                'registered_at'       => now(),
            ]
        );
        // participant has NO session selections (for selection tests)

        $reg2 = Registration::firstOrCreate(
            ['workshop_id' => $workshop->id, 'user_id' => $users['participant2']->id],
            [
                'registration_status' => 'registered',
                'registered_at'       => now(),
            ]
        );
        // participant2 has selected Session A (for capacity count tests)
        SessionSelection::firstOrCreate(
            ['registration_id' => $reg2->id, 'session_id' => $sessionA->id],
            ['selection_status' => 'selected']
        );
    }

    private function upsertUser(string $email, string $first, string $last): User
    {
        return User::firstOrCreate(
            ['email' => $email],
            [
                'first_name'              => $first,
                'last_name'               => $last,
                'password'                => Hash::make('Testing!2024'),
                'email_verified_at'       => now(),
                'is_active'               => true,
                'onboarding_completed_at' => now(),
            ]
        );
    }
}
