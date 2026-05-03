<?php

use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function umAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'UM',
        'last_name'     => "Admin{$seq}",
        'email'         => "um{$seq}@wayfield.internal",
        'password_hash' => Hash::make('pass'),
        'role'          => $role,
        'is_active'     => true,
    ]);
}

function umToken(AdminUser $admin): string
{
    return $admin->createToken('platform_token', ['platform:*'])->plainTextToken;
}

// ─── GET /users — list ─────────────────────────────────────────────────────────

test('GET /users returns paginated list with required shape', function () {
    $admin = umAdmin();
    User::factory()->count(3)->create();

    $this->withToken(umToken($admin))
        ->getJson('/api/platform/v1/users')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => [['id', 'first_name', 'last_name', 'email', 'is_active',
                        'email_verified_at', 'last_login_at', 'created_at', 'organization_count']],
            'total', 'per_page',
        ]);
});

test('GET /users search filters by name', function () {
    $admin = umAdmin();
    User::factory()->create(['first_name' => 'Alice', 'last_name' => 'Zed', 'email' => 'alice@example.com']);
    User::factory()->create(['first_name' => 'Bob', 'last_name' => 'Smith', 'email' => 'bob@example.com']);

    $this->withToken(umToken($admin))
        ->getJson('/api/platform/v1/users?search=Alice')
        ->assertStatus(200)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.first_name', 'Alice');
});

test('GET /users search filters by email', function () {
    $admin = umAdmin();
    User::factory()->create(['email' => 'target@example.com']);
    User::factory()->create(['email' => 'other@example.com']);

    $this->withToken(umToken($admin))
        ->getJson('/api/platform/v1/users?search=target')
        ->assertStatus(200)
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.email', 'target@example.com');
});

test('GET /users organization_count reflects org memberships', function () {
    $admin = umAdmin();
    $user  = User::factory()->create();
    $org1  = Organization::factory()->create();
    $org2  = Organization::factory()->create();

    OrganizationUser::create([
        'organization_id' => $org1->id,
        'user_id'         => $user->id,
        'role'            => 'staff',
        'is_active'       => true,
    ]);
    OrganizationUser::create([
        'organization_id' => $org2->id,
        'user_id'         => $user->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);

    $this->withToken(umToken($admin))
        ->getJson('/api/platform/v1/users?search='.urlencode($user->email))
        ->assertStatus(200)
        ->assertJsonPath('data.0.organization_count', 2);
});

// ─── GET /users/{id} — detail ─────────────────────────────────────────────────

test('GET /users/{id} returns full detail with organizations and login history', function () {
    $admin = umAdmin();
    $user  = User::factory()->create();
    $org   = Organization::factory()->create(['name' => 'Test Org']);

    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    DB::table('login_events')->insert([
        'user_id'          => $user->id,
        'email_attempted'  => $user->email,
        'ip_address'       => '1.2.3.4',
        'user_agent'       => 'TestAgent/1.0',
        'outcome'          => 'success',
        'created_at'       => now()->subMinutes(10),
    ]);

    $this->withToken(umToken($admin))
        ->getJson("/api/platform/v1/users/{$user->id}")
        ->assertStatus(200)
        ->assertJsonStructure([
            'id', 'first_name', 'last_name', 'email', 'is_active',
            'email_verified_at', 'last_login_at', 'created_at',
            'organizations' => [['id', 'name', 'role', 'joined_at']],
            'login_history'  => [['ip_address', 'user_agent', 'outcome', 'created_at']],
        ])
        ->assertJsonPath('organizations.0.name', 'Test Org')
        ->assertJsonPath('organizations.0.role', 'owner')
        ->assertJsonPath('login_history.0.ip_address', '1.2.3.4')
        ->assertJsonPath('login_history.0.outcome', 'success');
});

test('GET /users/{id} returns empty login_history when no events', function () {
    $admin = umAdmin();
    $user  = User::factory()->create();

    $this->withToken(umToken($admin))
        ->getJson("/api/platform/v1/users/{$user->id}")
        ->assertStatus(200)
        ->assertJsonPath('login_history', []);
});

test('GET /users/{id} returns 404 for unknown user', function () {
    $admin = umAdmin();

    $this->withToken(umToken($admin))
        ->getJson('/api/platform/v1/users/999999')
        ->assertStatus(404);
});

// ─── Auth isolation ────────────────────────────────────────────────────────────

test('GET /users is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/platform/v1/users')
        ->assertStatus(401);
});

test('GET /users/{id} is rejected with tenant token', function () {
    $user  = User::factory()->create();
    $token = $user->createToken('tenant')->plainTextToken;
    $other = User::factory()->create();

    $this->withToken($token)
        ->getJson("/api/platform/v1/users/{$other->id}")
        ->assertStatus(401);
});

test('GET /users requires authentication', function () {
    $this->getJson('/api/platform/v1/users')->assertStatus(401);
});
