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

        // ─────────────────────────────────────────
        // ORGANIZATION 1 — Cascade Photo Workshops
        // ─────────────────────────────────────────

        $org1Id = DB::table('organizations')->insertGetId([
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

        DB::table('subscriptions')->insert([
            'organization_id' => $org1Id,
            'plan_code'       => 'free',
            'status'          => 'active',
            'starts_at'       => now(),
            'ends_at'         => null,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // ─────────────────────────────────────────
        // ORGANIZATION 2 — Pacific Northwest Photo
        // ─────────────────────────────────────────

        $org2Id = DB::table('organizations')->insertGetId([
            'name'                       => 'Pacific Northwest Photo',
            'slug'                       => 'pnw-photo',
            'primary_contact_first_name' => 'Riley',
            'primary_contact_last_name'  => 'Thompson',
            'primary_contact_email'      => 'riley@pnwphoto.test',
            'primary_contact_phone'      => '+1-555-0200',
            'status'                     => 'active',
            'created_at'                 => now(),
            'updated_at'                 => now(),
        ]);

        DB::table('subscriptions')->insert([
            'organization_id' => $org2Id,
            'plan_code'       => 'starter',
            'status'          => 'active',
            'starts_at'       => now(),
            'ends_at'         => null,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $this->command->info('✓ Organizations created');

        // ─────────────────────────────────────────
        // USERS
        // ─────────────────────────────────────────

        $users = [
            // Org 1 users
            [
                'first_name'              => 'Jordan',
                'last_name'               => 'Alvarez',
                'email'                   => 'owner@wayfield.test',
                'org_id'                  => $org1Id,
                'role'                    => 'owner',
                'verified'                => true,
                'onboarding_intent'       => 'organizer',
                'onboarding_completed_at' => now(),
            ],
            [
                'first_name'              => 'Casey',
                'last_name'               => 'Morgan',
                'email'                   => 'admin@wayfield.test',
                'org_id'                  => $org1Id,
                'role'                    => 'admin',
                'verified'                => true,
                'onboarding_intent'       => 'organizer',
                'onboarding_completed_at' => now(),
            ],
            [
                'first_name'              => 'Drew',
                'last_name'               => 'Patterson',
                'email'                   => 'staff@wayfield.test',
                'org_id'                  => $org1Id,
                'role'                    => 'staff',
                'verified'                => true,
                'onboarding_intent'       => 'organizer',
                'onboarding_completed_at' => now(),
            ],
            // Org 2 users
            [
                'first_name'              => 'Riley',
                'last_name'               => 'Thompson',
                'email'                   => 'owner2@wayfield.test',
                'org_id'                  => $org2Id,
                'role'                    => 'owner',
                'verified'                => true,
                'onboarding_intent'       => 'organizer',
                'onboarding_completed_at' => now(),
            ],
            // Participants (no org membership)
            [
                'first_name'              => 'Alex',
                'last_name'               => 'Rivera',
                'email'                   => 'participant1@wayfield.test',
                'org_id'                  => null,
                'role'                    => null,
                'verified'                => true,
                'onboarding_intent'       => 'participant',
                'onboarding_completed_at' => now(),
            ],
            [
                'first_name'              => 'Sam',
                'last_name'               => 'Chen',
                'email'                   => 'participant2@wayfield.test',
                'org_id'                  => null,
                'role'                    => null,
                'verified'                => true,
                'onboarding_intent'       => 'participant',
                'onboarding_completed_at' => now(),
            ],
            [
                'first_name'              => 'Taylor',
                'last_name'               => 'Kim',
                'email'                   => 'participant3@wayfield.test',
                'org_id'                  => null,
                'role'                    => null,
                'verified'                => false, // unverified — for edge case testing
                'onboarding_intent'       => 'participant',
                'onboarding_completed_at' => now(),
            ],
        ];

        $userIds = [];
        foreach ($users as $userData) {
            $userId = DB::table('users')->insertGetId([
                'first_name'              => $userData['first_name'],
                'last_name'               => $userData['last_name'],
                'email'                   => $userData['email'],
                'password_hash'           => Hash::make('Testing!2024'),
                'email_verified_at'       => $userData['verified'] ? now() : null,
                'is_active'               => true,
                'onboarding_intent'       => $userData['onboarding_intent'],
                'onboarding_completed_at' => $userData['onboarding_completed_at'],
                'created_at'              => now(),
                'updated_at'              => now(),
            ]);

            DB::table('auth_methods')->insert([
                'user_id'    => $userId,
                'provider'   => 'email',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($userData['org_id'] && $userData['role']) {
                DB::table('organization_users')->insert([
                    'organization_id' => $userData['org_id'],
                    'user_id'         => $userId,
                    'role'            => $userData['role'],
                    'is_active'       => true,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
            }

            $userIds[$userData['email']] = $userId;
        }

        $this->command->info('✓ Users created and linked to organizations');

        // ─────────────────────────────────────────
        // LOCATION
        // ─────────────────────────────────────────

        $locationId = DB::table('locations')->insertGetId([
            'organization_id' => $org1Id,
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

        // ─────────────────────────────────────────
        // WORKSHOP — Published, Session-based
        // ─────────────────────────────────────────

        $joinCode1 = strtoupper(Str::random(8));

        $workshop1Id = DB::table('workshops')->insertGetId([
            'organization_id'     => $org1Id,
            'workshop_type'       => 'session_based',
            'title'               => 'Landscape Photography Intensive',
            'description'         => 'A three-day intensive workshop covering landscape, wildlife, and night photography in the Pacific Northwest.',
            'status'              => 'published',
            'timezone'            => 'America/Los_Angeles',
            'start_date'          => now()->addDays(30)->toDateString(),
            'end_date'            => now()->addDays(32)->toDateString(),
            'join_code'           => $joinCode1,
            'default_location_id' => $locationId,
            'public_page_enabled' => true,
            'public_slug'         => 'landscape-photography-intensive',
            'header_image_url'    => 'https://picsum.photos/seed/rainier-landscape/1200/630',
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        DB::table('workshop_logistics')->insert([
            'workshop_id'         => $workshop1Id,
            'hotel_name'          => 'Paradise Inn',
            'hotel_address'       => '52807 Paradise Rd E, Ashford, WA 98304',
            'hotel_phone'         => '+1-360-569-2413',
            'hotel_notes'         => 'Book directly — mention Wayfield workshop for group rate',
            'parking_details'     => 'Free parking at visitor center lot. Arrive by 7:30am.',
            'meeting_room_details'=> 'Jackson Visitor Center main hall.',
            'meetup_instructions' => 'Look for the orange Wayfield banner at the north entrance.',
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        // Workshop 2 — Draft
        $joinCode2 = strtoupper(Str::random(8));

        $workshop2Id = DB::table('workshops')->insertGetId([
            'organization_id'     => $org1Id,
            'workshop_type'       => 'event_based',
            'title'               => 'Night Sky Photography Meetup',
            'description'         => 'An evening event capturing the Milky Way from a dark sky site.',
            'status'              => 'draft',
            'timezone'            => 'America/Los_Angeles',
            'start_date'          => now()->addDays(60)->toDateString(),
            'end_date'            => now()->addDays(60)->toDateString(),
            'join_code'           => $joinCode2,
            'default_location_id' => $locationId,
            'public_page_enabled' => false,
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        $this->command->info('✓ Workshops created');
        $this->command->info('  Join code (Workshop 1): ' . $joinCode1);
        $this->command->info('  Join code (Workshop 2): ' . $joinCode2);

        // ─────────────────────────────────────────
        // TRACKS
        // ─────────────────────────────────────────

        $track1Id = DB::table('tracks')->insertGetId([
            'workshop_id' => $workshop1Id,
            'title'       => 'Landscape',
            'description' => 'Landscape and scenic photography',
            'sort_order'  => 1,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $track2Id = DB::table('tracks')->insertGetId([
            'workshop_id' => $workshop1Id,
            'title'       => 'Wildlife',
            'description' => 'Wildlife and nature photography',
            'sort_order'  => 2,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // ─────────────────────────────────────────
        // SESSIONS
        // ─────────────────────────────────────────

        $base = Carbon::now('America/Los_Angeles')
            ->addDays(30)->startOfDay();

        $session1Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshop1Id,
            'track_id'      => $track1Id,
            'title'         => 'Golden Hour Landscapes',
            'description'   => 'Capturing light and shadow at sunrise.',
            'start_at'      => $base->copy()->setHour(9)->utc(),
            'end_at'        => $base->copy()->setHour(12)->utc(),
            'location_id'   => $locationId,
            'capacity'      => 15,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $session2Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshop1Id,
            'track_id'      => $track2Id,
            'title'         => 'Wildlife at Dawn',
            'description'   => 'Early morning wildlife photography.',
            'start_at'      => $base->copy()->setHour(9)->utc(),
            'end_at'        => $base->copy()->setHour(12)->utc(),
            'location_id'   => $locationId,
            'capacity'      => 10,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $session3Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshop1Id,
            'track_id'      => $track1Id,
            'title'         => 'Composition Masterclass',
            'description'   => 'Advanced composition techniques.',
            'start_at'      => $base->copy()->setHour(13)->utc(),
            'end_at'        => $base->copy()->setHour(16)->utc(),
            'location_id'   => $locationId,
            'capacity'      => null,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $session4Id = DB::table('sessions')->insertGetId([
            'workshop_id'      => $workshop1Id,
            'track_id'         => null,
            'title'            => 'Evening Q&A — Virtual',
            'description'      => 'Live Q&A via Zoom.',
            'start_at'         => $base->copy()->setHour(19)->utc(),
            'end_at'           => $base->copy()->setHour(20)->utc(),
            'location_id'      => null,
            'capacity'         => 50,
            'delivery_type'    => 'virtual',
            'meeting_platform' => 'Zoom',
            'meeting_url'      => 'https://zoom.us/j/123456789',
            'meeting_id'       => '123 456 789',
            'meeting_passcode' => 'photo2024',
            'is_published'     => true,
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        $session5Id = DB::table('sessions')->insertGetId([
            'workshop_id'   => $workshop1Id,
            'track_id'      => $track2Id,
            'title'         => 'One-on-One Critique (Limited)',
            'description'   => 'Individual portfolio review. Only 2 spots.',
            'start_at'      => $base->copy()->addDay()->setHour(14)->utc(),
            'end_at'        => $base->copy()->addDay()->setHour(15)->utc(),
            'location_id'   => $locationId,
            'capacity'      => 2,
            'delivery_type' => 'in_person',
            'is_published'  => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);

        $this->command->info('✓ Tracks and sessions created');

        // ─────────────────────────────────────────
        // LEADERS
        // ─────────────────────────────────────────

        // Leader 1 — has user account, accepted
        $leader1UserId = DB::table('users')->insertGetId([
            'first_name'              => 'Morgan',
            'last_name'               => 'Blake',
            'email'                   => 'leader@wayfield.test',
            'password_hash'           => Hash::make('Testing!2024'),
            'email_verified_at'       => now(),
            'is_active'               => true,
            'onboarding_intent'       => null,
            'onboarding_completed_at' => now(),
            'created_at'              => now(),
            'updated_at'              => now(),
        ]);

        DB::table('auth_methods')->insert([
            'user_id'    => $leader1UserId,
            'provider'   => 'email',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leader1Id = DB::table('leaders')->insertGetId([
            'user_id'           => $leader1UserId,
            'first_name'        => 'Morgan',
            'last_name'         => 'Blake',
            'display_name'      => 'Morgan Blake Photography',
            'bio'               => 'Award-winning landscape photographer with 15 years of field experience across the Pacific Northwest.',
            'profile_image_url' => 'https://picsum.photos/seed/morgan-blake/200/200',
            'website_url'       => 'https://morganblakephoto.com',
            'email'             => 'morgan@morganblakephoto.com',
            'phone_number'      => '+1-555-0199',
            'city'              => 'Seattle',
            'state_or_region'   => 'WA',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        // Leader 2 — invitation pending (no user account yet)
        $leader2Id = DB::table('leaders')->insertGetId([
            'user_id'         => null,
            'first_name'      => 'Jamie',
            'last_name'       => 'Osei',
            'bio'             => null,
            'city'            => 'Portland',
            'state_or_region' => 'OR',
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        // Leader 3 — accepted, second org
        $leader3UserId = DB::table('users')->insertGetId([
            'first_name'              => 'Priya',
            'last_name'               => 'Sharma',
            'email'                   => 'leader2@wayfield.test',
            'password_hash'           => Hash::make('Testing!2024'),
            'email_verified_at'       => now(),
            'is_active'               => true,
            'onboarding_intent'       => null,
            'onboarding_completed_at' => now(),
            'created_at'              => now(),
            'updated_at'              => now(),
        ]);

        DB::table('auth_methods')->insert([
            'user_id'    => $leader3UserId,
            'provider'   => 'email',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $leader3Id = DB::table('leaders')->insertGetId([
            'user_id'           => $leader3UserId,
            'first_name'        => 'Priya',
            'last_name'         => 'Sharma',
            'bio'               => 'Wildlife and macro photographer specializing in Pacific Northwest fauna.',
            'profile_image_url' => 'https://picsum.photos/seed/priya-sharma/200/200',
            'website_url'       => 'https://priyasharma.photo',
            'phone_number'      => '+1-555-0198',
            'city'              => 'Bellingham',
            'state_or_region'   => 'WA',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        // Link leaders to organization
        DB::table('organization_leaders')->insert([
            [
                'organization_id' => $org1Id,
                'leader_id'       => $leader1Id,
                'status'          => 'active',
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
            [
                'organization_id' => $org1Id,
                'leader_id'       => $leader2Id,
                'status'          => 'active',
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
            [
                'organization_id' => $org1Id,
                'leader_id'       => $leader3Id,
                'status'          => 'active',
                'created_at'      => now(),
                'updated_at'      => now(),
            ],
        ]);

        // Link leaders to workshop
        DB::table('workshop_leaders')->insert([
            [
                'workshop_id'  => $workshop1Id,
                'leader_id'    => $leader1Id,
                'is_confirmed' => true,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'workshop_id'  => $workshop1Id,
                'leader_id'    => $leader3Id,
                'is_confirmed' => true,
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
            [
                'workshop_id'  => $workshop1Id,
                'leader_id'    => $leader2Id,
                'is_confirmed' => false, // pending invitation
                'created_at'   => now(),
                'updated_at'   => now(),
            ],
        ]);

        // Assign leaders to sessions
        DB::table('session_leaders')->insert([
            [
                'session_id'  => $session1Id,
                'leader_id'   => $leader1Id,
                'role_label'  => 'Lead Instructor',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'session_id'  => $session3Id,
                'leader_id'   => $leader1Id,
                'role_label'  => 'Lead Instructor',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
            [
                'session_id'  => $session2Id,
                'leader_id'   => $leader3Id,
                'role_label'  => 'Lead Instructor',
                'created_at'  => now(),
                'updated_at'  => now(),
            ],
        ]);

        // Invitations
        DB::table('leader_invitations')->insert([
            [
                'organization_id'       => $org1Id,
                'workshop_id'           => $workshop1Id,
                'leader_id'             => $leader1Id,
                'invited_email'         => 'morgan@morganblakephoto.com',
                'invited_first_name'    => 'Morgan',
                'invited_last_name'     => 'Blake',
                'status'                => 'accepted',
                'invitation_token_hash' => hash('sha256', Str::random(64)),
                'expires_at'            => now()->addDays(7),
                'responded_at'          => now()->subDays(5),
                'created_by_user_id'    => $userIds['owner@wayfield.test'],
                'created_at'            => now()->subDays(10),
                'updated_at'            => now()->subDays(5),
            ],
            [
                'organization_id'       => $org1Id,
                'workshop_id'           => $workshop1Id,
                'leader_id'             => $leader2Id,
                'invited_email'         => 'jamie@example.com',
                'invited_first_name'    => 'Jamie',
                'invited_last_name'     => 'Osei',
                'status'                => 'pending',
                'invitation_token_hash' => hash('sha256', Str::random(64)),
                'expires_at'            => now()->addDays(7),
                'responded_at'          => null,
                'created_by_user_id'    => $userIds['owner@wayfield.test'],
                'created_at'            => now()->subDays(2),
                'updated_at'            => now()->subDays(2),
            ],
            [
                'organization_id'       => $org1Id,
                'workshop_id'           => $workshop1Id,
                'leader_id'             => $leader3Id,
                'invited_email'         => 'priya@priyasharma.photo',
                'invited_first_name'    => 'Priya',
                'invited_last_name'     => 'Sharma',
                'status'                => 'accepted',
                'invitation_token_hash' => hash('sha256', Str::random(64)),
                'expires_at'            => now()->addDays(7),
                'responded_at'          => now()->subDays(3),
                'created_by_user_id'    => $userIds['owner@wayfield.test'],
                'created_at'            => now()->subDays(8),
                'updated_at'            => now()->subDays(3),
            ],
        ]);

        $this->command->info('✓ Leaders created and assigned');

        // ─────────────────────────────────────────
        // REGISTRATIONS AND SELECTIONS
        // ─────────────────────────────────────────

        $reg1Id = DB::table('registrations')->insertGetId([
            'workshop_id'         => $workshop1Id,
            'user_id'             => $userIds['participant1@wayfield.test'],
            'registration_status' => 'registered',
            'joined_via_code'     => $joinCode1,
            'registered_at'       => now(),
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        $reg2Id = DB::table('registrations')->insertGetId([
            'workshop_id'         => $workshop1Id,
            'user_id'             => $userIds['participant2@wayfield.test'],
            'registration_status' => 'registered',
            'joined_via_code'     => $joinCode1,
            'registered_at'       => now(),
            'created_at'          => now(),
            'updated_at'          => now(),
        ]);

        // Participant 1 selects sessions 1 and 3
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

        // Participant 2 selects sessions 2 and 4
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
            'session_id'      => $session1Id,
            'user_id'         => $userIds['participant1@wayfield.test'],
            'status'          => 'checked_in',
            'check_in_method' => 'self',
            'checked_in_at'   => now()->subHours(1),
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        $this->command->info('✓ Registrations, selections, and attendance created');

        // ─────────────────────────────────────────
        // SUMMARY OUTPUT
        // ─────────────────────────────────────────

        $this->command->newLine();
        $this->command->info('════════════════════════════════════════════');
        $this->command->info('  WAYFIELD TEST DATA READY');
        $this->command->info('════════════════════════════════════════════');
        $this->command->newLine();
        $this->command->info('PASSWORD FOR ALL ACCOUNTS: Testing!2024');
        $this->command->newLine();
        $this->command->info('ORGANIZATION 1 — Cascade Photo Workshops (Free plan)');
        $this->command->info('  owner@wayfield.test        Owner');
        $this->command->info('  admin@wayfield.test        Admin');
        $this->command->info('  staff@wayfield.test        Staff');
        $this->command->newLine();
        $this->command->info('ORGANIZATION 2 — Pacific Northwest Photo (Starter plan)');
        $this->command->info('  owner2@wayfield.test       Owner');
        $this->command->newLine();
        $this->command->info('PARTICIPANTS (no org membership)');
        $this->command->info('  participant1@wayfield.test  Registered + checked in to Session 1');
        $this->command->info('  participant2@wayfield.test  Registered + 2 sessions selected');
        $this->command->info('  participant3@wayfield.test  Unverified email — edge case');
        $this->command->newLine();
        $this->command->info('LEADERS');
        $this->command->info('  leader@wayfield.test       Morgan Blake — accepted, sessions 1+3');
        $this->command->info('  leader2@wayfield.test      Priya Sharma — accepted, session 2');
        $this->command->info('  Jamie Osei                 Pending invitation — no login yet');
        $this->command->newLine();
        $this->command->info('WORKSHOP JOIN CODES');
        $this->command->info('  Workshop 1 (published): ' . $joinCode1);
        $this->command->info('  Workshop 2 (draft):     ' . $joinCode2);
        $this->command->info('════════════════════════════════════════════');
    }
}