<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

class WayfieldTestDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding Wayfield test data...');

        // ─────────────────────────────
        // USERS
        // ─────────────────────────────

        // Organizer / Owner
        $ownerId = DB::table('users')->insertGetId([
            'first_name'       => 'Jordan',
            'last_name'        => 'Alvarez',
            'email'            => 'owner@wayfield.test',
            'password_hash'    => Hash::make('Testing!2024'),
            'email_verified_at'=> now(),
            'is_active'        => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        // Admin user
        $adminId = DB::table('users')->insertGetId([
            'first_name'       => 'Casey',
            'last_name'        => 'Morgan',
            'email'            => 'admin@wayfield.test',
            'password_hash'    => Hash::make('Testing!2024'),
            'email_verified_at'=> now(),
            'is_active'        => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        // Participant 1
        $participant1Id = DB::table('users')->insertGetId([
            'first_name'       => 'Alex',
            'last_name'        => 'Rivera',
            'email'            => 'participant1@wayfield.test',
            'password_hash'    => Hash::make('Testing!2024'),
            'email_verified_at'=> now(),
            'is_active'        => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        // Participant 2
        $participant2Id = DB::table('users')->insertGetId([
            'first_name'       => 'Sam',
            'last_name'        => 'Chen',
            'email'            => 'participant2@wayfield.test',
            'password_hash'    => Hash::make('Testing!2024'),
            'email_verified_at'=> now(),
            'is_active'        => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        // Participant 3 (unverified — edge case)
        $participant3Id = DB::table('users')->insertGetId([
            'first_name'       => 'Taylor',
            'last_name'        => 'Kim',
            'email'            => 'participant3@wayfield.test',
            'password_hash'    => Hash::make('Testing!2024'),
            'email_verified_at'=> null,  // unverified
            'is_active'        => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        // auth_methods for all users
        foreach ([$ownerId, $adminId, $participant1Id, $participant2Id, $participant3Id] as $uid) {
            DB::table('auth_methods')->insert([
                'user_id'    => $uid,
                'provider'   => 'email',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->command->info('✓ Users created');

        // ─────────────────────────────
        // ORGANIZATION
        // ─────────────────────────────

        $orgId = DB::table('organizations')->insertGetId([
            'name'                       => 'Cascade Photo Workshops',
            'slug'                       => 'cascade-photo',
            'primary_contact_first_name' => 'Jordan',
            'primary_contact_last_name'  => 'Alvarez',
            'primary_contact_email'      => 'jordan@cascadephoto.test',
            'primary_contact_phone'      => '+1-555-0100',
            'status'                     => 'active',
            'created_at'                 => now(),
            'updated_at'                 => now(),
        ]);

        // Owner membership
        DB::table('organization_users')->insert([
            'organization_id' => $orgId,
            'user_id'         => $ownerId,
            'role'            => 'owner',
            'is_active'       => true,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Admin membership
        DB::table('organization_users')->insert([
            'organization_id' => $orgId,
            'user_id'         => $adminId,
            'role'            => 'admin',
            'is_active'       => true,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Free subscription
        DB::table('subscriptions')->insert([
            'organization_id' => $orgId,
            'plan_code'       => 'free',
            'status'          => 'active',
            'starts_at'       => now(),
            'ends_at'         => null,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $this->command->info('✓ Organization created');

        // ─────────────────────────────
        // LOCATION
        // ─────────────────────────────

        $locationId = DB::table('locations')->insertGetId([
            'organization_id' => $orgId,
            'name'            => 'Mount Rainier Visitor Center',
            'address_line_1'  => '52807 Paradise Rd E',
            'city'            => 'Ashford',
            'state_or_region' => 'WA',
            'postal_code'     => '98304',
            'country'         => 'US',
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $this->command->info('✓ Location created');

        // ─────────────────────────────
        // WORKSHOP — SESSION-BASED (Published)
        // ─────────────────────────────

        $joinCode = strtoupper(Str::random(8));

        $workshopId = DB::table('workshops')->insertGetId([
            'organization_id'    => $orgId,
            'workshop_type'      => 'session_based',
            'title'              => 'Landscape Photography Intensive',
            'description'        => 'A three-day intensive workshop covering landscape, wildlife, and night photography techniques in the Pacific Northwest.',
            'status'             => 'published',
            'timezone'           => 'America/Los_Angeles',
            'start_date'         => now()->addDays(30)->toDateString(),
            'end_date'           => now()->addDays(32)->toDateString(),
            'join_code'          => $joinCode,
            'default_location_id'=> $locationId,
            'public_page_enabled'=> true,
            'public_slug'        => 'landscape-photography-intensive',
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        // Workshop logistics
        DB::table('workshop_logistics')->insert([
            'workshop_id'         => $workshopId,
            'hotel_name'          => 'Paradise Inn',
            'hotel_address'       => '52807 Paradise Rd E, Ashford, WA 98304',
            'hotel_phone'         => '+1-360-569-2413',
            'hotel_notes'         => 'Book directly — mention Wayfield workshop for group rate',
            'parking_details'     => 'Free parking at visitor center lot. Arrive by 7:30am for Day 1.',
            'meeting_room_details'=> 'We will meet at the Jackson Visitor Center main hall.',
            'meetup_instructions' => 'Look for the orange Wayfield banner at the north entrance.',
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        // ─────────────────────────────
        // WORKSHOP 2 — EVENT-BASED (Draft)
        // ─────────────────────────────

        $eventJoinCode = strtoupper(Str::random(8));

        $eventWorkshopId = DB::table('workshops')->insertGetId([
            'organization_id'    => $orgId,
            'workshop_type'      => 'event_based',
            'title'              => 'Night Sky Photography Meetup',
            'description'        => 'An evening event capturing the Milky Way from a dark sky site.',
            'status'             => 'draft',
            'timezone'           => 'America/Los_Angeles',
            'start_date'         => now()->addDays(60)->toDateString(),
            'end_date'           => now()->addDays(60)->toDateString(),
            'join_code'          => $eventJoinCode,
            'default_location_id'=> $locationId,
            'public_page_enabled'=> false,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        $this->command->info('✓ Workshops created (join code: ' . $joinCode . ')');

        // ─────────────────────────────
        // TRACKS
        // ─────────────────────────────

        $track1Id = DB::table('tracks')->insertGetId([
            'workshop_id' => $workshopId,
            'title'       => 'Landscape',
            'description' => 'Landscape and scenic photography',
            'sort_order'  => 1,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $track2Id = DB::table('tracks')->insertGetId([
            'workshop_id' => $workshopId,
            'title'       => 'Wildlife',
            'description' => 'Wildlife and nature photography',
            'sort_order'  => 2,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $this->command->info('✓ Tracks created');

        // ─────────────────────────────
        // SESSIONS (non-overlapping per track)
        // ─────────────────────────────

        $baseDate = now()->addDays(30)->setTimezone('America/Los_Angeles')->startOfDay();

        // Day 1 Morning — Landscape track (9am–12pm)
        $session1Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshopId,
            'track_id'      => $track1Id,
            'title'         => 'Golden Hour Landscapes',
            'description'   => 'Capturing light and shadow in open landscapes at sunrise.',
            'start_at'      => $baseDate->copy()->setHour(9),
            'end_at'        => $baseDate->copy()->setHour(12),
            'location_id'   => $locationId,
            'capacity'      => 15,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // Day 1 Morning — Wildlife track (9am–12pm) [overlaps with session1]
        $session2Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshopId,
            'track_id'      => $track2Id,
            'title'         => 'Wildlife at Dawn',
            'description'   => 'Early morning wildlife observation and photography.',
            'start_at'      => $baseDate->copy()->setHour(9),
            'end_at'        => $baseDate->copy()->setHour(12),
            'location_id'   => $locationId,
            'capacity'      => 10,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // Day 1 Afternoon (1pm–4pm) — no overlap with above
        $session3Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshopId,
            'track_id'      => $track1Id,
            'title'         => 'Composition Masterclass',
            'description'   => 'Advanced composition techniques and creative framing.',
            'start_at'      => $baseDate->copy()->setHour(13),
            'end_at'        => $baseDate->copy()->setHour(16),
            'location_id'   => $locationId,
            'capacity'      => null,  // unlimited
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // Virtual session
        $session4Id = DB::table('sessions')->insertGetId([
            'workshop_id'        => $workshopId,
            'track_id'           => null,
            'title'              => 'Evening Q&A — Virtual',
            'description'        => 'Live Q&A with instructors via Zoom.',
            'start_at'           => $baseDate->copy()->setHour(19),
            'end_at'             => $baseDate->copy()->setHour(20),
            'location_id'        => null,
            'capacity'           => 50,
            'delivery_type'      => 'virtual',
            'meeting_platform'   => 'Zoom',
            'meeting_url'        => 'https://zoom.us/j/123456789',
            'meeting_id'         => '123 456 789',
            'meeting_passcode'   => 'photo2024',
            'is_published'       => true,
            'created_at'         => now(),
            'updated_at'         => now(),
        ]);

        // Capacity-limited session (capacity = 2 for testing limits)
        $session5Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshopId,
            'track_id'      => $track2Id,
            'title'         => 'One-on-One Critique (Limited)',
            'description'   => 'Individual portfolio review. Only 2 spots available.',
            'start_at'      => $baseDate->copy()->addDay()->setHour(14),
            'end_at'        => $baseDate->copy()->addDay()->setHour(15),
            'location_id'   => $locationId,
            'capacity'      => 2,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $this->command->info('✓ Sessions created');

        // ─────────────────────────────
        // LEADER
        // ─────────────────────────────

        // Leader user account
        $leaderUserId = DB::table('users')->insertGetId([
            'first_name'       => 'Morgan',
            'last_name'        => 'Blake',
            'email'            => 'leader@wayfield.test',
            'password_hash'    => Hash::make('Testing!2024'),
            'email_verified_at'=> now(),
            'is_active'        => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        DB::table('auth_methods')->insert([
            'user_id'    => $leaderUserId,
            'provider'   => 'email',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Leader profile
        $leaderId = DB::table('leaders')->insertGetId([
            'user_id'         => $leaderUserId,
            'first_name'      => 'Morgan',
            'last_name'       => 'Blake',
            'display_name'    => 'Morgan Blake Photography',
            'bio'             => 'Award-winning landscape photographer with 15 years of field experience across the Pacific Northwest and Patagonia.',
            'profile_image_url'=> null,
            'website_url'     => 'https://morganblakephoto.com',
            'email'           => 'morgan@morganblakephoto.com',
            'phone_number'    => '+1-555-0199',
            'city'            => 'Seattle',
            'state_or_region' => 'WA',
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Link leader to organization
        DB::table('organization_leaders')->insert([
            'organization_id' => $orgId,
            'leader_id'       => $leaderId,
            'status'          => 'active',
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Assign leader to workshop
        DB::table('workshop_leaders')->insert([
            'workshop_id'   => $workshopId,
            'leader_id'     => $leaderId,
            'is_confirmed'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        // Assign leader to session 1 and session 3
        DB::table('session_leaders')->insert([
            [
                'session_id'  => $session1Id,
                'leader_id'   => $leaderId,
                'role_label'  => 'Lead Instructor',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'session_id'  => $session3Id,
                'leader_id'   => $leaderId,
                'role_label'  => 'Lead Instructor',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);

        $this->command->info('✓ Leader created and assigned');

        // ─────────────────────────────
        // REGISTRATIONS (Participants 1 and 2 join the published workshop)
        // ─────────────────────────────

        $reg1Id = DB::table('registrations')->insertGetId([
            'workshop_id'         => $workshopId,
            'user_id'             => $participant1Id,
            'registration_status' => 'registered',
            'joined_via_code'     => $joinCode,
            'registered_at'       => now(),
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        $reg2Id = DB::table('registrations')->insertGetId([
            'workshop_id'         => $workshopId,
            'user_id'             => $participant2Id,
            'registration_status' => 'registered',
            'joined_via_code'     => $joinCode,
            'registered_at'       => now(),
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        // Participant 1 selects session 1 (Landscape morning) and session 3 (afternoon)
        DB::table('session_selections')->insert([
            [
                'registration_id'  => $reg1Id,
                'session_id'       => $session1Id,
                'selection_status' => 'selected',
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            [
                'registration_id'  => $reg1Id,
                'session_id'       => $session3Id,
                'selection_status' => 'selected',
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
        ]);

        // Participant 2 selects session 2 (Wildlife morning) and session 4 (virtual)
        DB::table('session_selections')->insert([
            [
                'registration_id'  => $reg2Id,
                'session_id'       => $session2Id,
                'selection_status' => 'selected',
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
            [
                'registration_id'  => $reg2Id,
                'session_id'       => $session4Id,
                'selection_status' => 'selected',
                'created_at'       => now(),
                'updated_at'       => now(),
            ],
        ]);

        // Participant 1 already checked in to session 1
        DB::table('attendance_records')->insert([
            'session_id'       => $session1Id,
            'user_id'          => $participant1Id,
            'status'           => 'checked_in',
            'check_in_method'  => 'self',
            'checked_in_at'    => now()->subHours(1),
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        $this->command->info('✓ Registrations and selections created');

        // ─────────────────────────────
        // OUTPUT SUMMARY
        // ─────────────────────────────

        $this->command->newLine();
        $this->command->info('═══════════════════════════════════════');
        $this->command->info('  TEST DATA READY');
        $this->command->info('═══════════════════════════════════════');
        $this->command->info('');
        $this->command->info('LOGIN CREDENTIALS (password: Testing!2024)');
        $this->command->info('  Owner:        owner@wayfield.test');
        $this->command->info('  Admin:        admin@wayfield.test');
        $this->command->info('  Participant 1: participant1@wayfield.test');
        $this->command->info('  Participant 2: participant2@wayfield.test');
        $this->command->info('  Participant 3: participant3@wayfield.test (unverified)');
        $this->command->info('  Leader:        leader@wayfield.test');
        $this->command->info('');
        $this->command->info('WORKSHOP JOIN CODE: ' . $joinCode);
        $this->command->info('WORKSHOP SLUG: landscape-photography-intensive');
        $this->command->info('ORGANIZATION: cascade-photo');
        $this->command->info('');
        $this->command->info('SESSION IDs (check DB for exact values):');
        $this->command->info('  Session 1: Golden Hour Landscapes (capacity 15, in-person)');
        $this->command->info('  Session 2: Wildlife at Dawn (capacity 10, in-person)');
        $this->command->info('  Session 3: Composition Masterclass (unlimited, in-person)');
        $this->command->info('  Session 4: Evening Q&A (capacity 50, virtual, has meeting URL)');
        $this->command->info('  Session 5: One-on-One Critique (capacity 2 - for limit testing)');
        $this->command->info('═══════════════════════════════════════');
    }
}