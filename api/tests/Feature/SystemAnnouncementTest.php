<?php

use App\Models\AdminUser;
use App\Models\SystemAnnouncement;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAnnouncementAdmin(string $role = 'super_admin'): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name' => 'Announce',
        'last_name' => "Admin{$seq}",
        'email' => "announce{$seq}@wayfield.internal",
        'password_hash' => Hash::make('password'),
        'role' => $role,
        'is_active' => true,
    ]);
}

function makeAnnouncement(array $overrides = []): SystemAnnouncement
{
    $admin = makeAnnouncementAdmin();

    return SystemAnnouncement::create(array_merge([
        'title' => 'Test Announcement',
        'message' => 'This is a test message.',
        'announcement_type' => 'info',
        'severity' => 'low',
        'target_audience' => 'all',
        'is_active' => true,
        'is_dismissable' => true,
        'starts_at' => now()->subHour(),
        'ends_at' => null,
        'created_by_admin_id' => $admin->id,
    ], $overrides));
}

// ─── Tenant endpoint ─────────────────────────────────────────────────────────

test('test_active_announcement_appears_in_tenant_endpoint', function () {
    $user = User::factory()->create();
    $announcement = makeAnnouncement([
        'is_active' => true,
        'starts_at' => now()->subHour(),
        'ends_at' => null,
    ]);

    $response = $this->actingAs($user)
        ->getJson('/api/v1/system/announcements')
        ->assertStatus(200);

    $data = $response->json('data');
    expect($data)->toHaveCount(1);

    $item = $data[0];
    expect($item)->toHaveKeys(['id', 'title', 'message', 'announcement_type', 'severity', 'is_dismissable', 'color']);
    expect($item['id'])->toBe($announcement->id);
    expect($item)->not->toHaveKey('created_by_admin_id');
    expect($item)->not->toHaveKey('is_active');
    expect($item['color'])->toBe(SystemAnnouncement::TYPE_COLORS['info']);
});

test('test_inactive_announcement_not_returned', function () {
    $user = User::factory()->create();
    makeAnnouncement(['is_active' => false]);

    $this->actingAs($user)
        ->getJson('/api/v1/system/announcements')
        ->assertStatus(200)
        ->assertJson(['data' => []]);
});

test('test_future_announcement_not_yet_shown', function () {
    $user = User::factory()->create();
    makeAnnouncement([
        'is_active' => true,
        'starts_at' => now()->addHours(2),
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/system/announcements')
        ->assertStatus(200)
        ->assertJson(['data' => []]);
});

test('test_expired_announcement_not_returned', function () {
    $user = User::factory()->create();
    makeAnnouncement([
        'is_active' => true,
        'starts_at' => now()->subHours(3),
        'ends_at' => now()->subHour(),
    ]);

    $this->actingAs($user)
        ->getJson('/api/v1/system/announcements')
        ->assertStatus(200)
        ->assertJson(['data' => []]);
});

test('test_unauthenticated_request_cannot_read_announcements', function () {
    $this->getJson('/api/v1/system/announcements')
        ->assertStatus(401);
});

// ─── Platform admin endpoints ─────────────────────────────────────────────────

test('test_platform_admin_can_create_announcement', function () {
    $admin = makeAnnouncementAdmin('super_admin');

    $payload = [
        'title' => 'Scheduled Maintenance',
        'message' => 'We will be down for maintenance.',
        'announcement_type' => 'maintenance',
        'severity' => 'high',
        'starts_at' => now()->addHour()->toIso8601String(),
    ];

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/system-announcements', $payload)
        ->assertStatus(201);

    $this->assertDatabaseHas('system_announcements', [
        'title' => 'Scheduled Maintenance',
        'created_by_admin_id' => $admin->id,
    ]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'system_announcement_created',
        'admin_user_id' => $admin->id,
    ]);
});

test('test_super_admin_can_create_announcement', function () {
    $admin = makeAnnouncementAdmin('super_admin');

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/system-announcements', [
            'title' => 'Test',
            'message' => 'Test message',
            'announcement_type' => 'info',
            'starts_at' => now()->toIso8601String(),
        ])
        ->assertStatus(201);
});

test('test_support_role_cannot_create_announcement', function () {
    $admin = makeAnnouncementAdmin('support');

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/system-announcements', [
            'title' => 'Test',
            'message' => 'Test message',
            'announcement_type' => 'info',
            'starts_at' => now()->toIso8601String(),
        ])
        ->assertStatus(403);
});

test('ops_role_cannot_create_announcement', function () {
    // 'readonly' is the closest to old 'ops' without write access
    $admin = makeAnnouncementAdmin('readonly');

    $this->actingAs($admin, 'platform_admin')
        ->postJson('/api/platform/v1/system-announcements', [
            'title' => 'Test',
            'message' => 'Test message',
            'announcement_type' => 'info',
            'starts_at' => now()->toIso8601String(),
        ])
        ->assertStatus(403);
});

test('super_admin_can_update_announcement', function () {
    $admin = makeAnnouncementAdmin('super_admin');
    $announcement = makeAnnouncement();

    $this->actingAs($admin, 'platform_admin')
        ->patchJson("/api/platform/v1/system-announcements/{$announcement->id}", [
            'is_active' => false,
        ])
        ->assertStatus(200)
        ->assertJsonFragment(['is_active' => false]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'system_announcement_updated',
        'admin_user_id' => $admin->id,
    ]);
});

test('support_role_cannot_update_announcement', function () {
    $admin = makeAnnouncementAdmin('support');
    $announcement = makeAnnouncement();

    $this->actingAs($admin, 'platform_admin')
        ->patchJson("/api/platform/v1/system-announcements/{$announcement->id}", [
            'is_active' => false,
        ])
        ->assertStatus(403);
});

test('super_admin_can_delete_announcement', function () {
    $admin = makeAnnouncementAdmin('super_admin');
    $announcement = makeAnnouncement();

    $this->actingAs($admin, 'platform_admin')
        ->deleteJson("/api/platform/v1/system-announcements/{$announcement->id}")
        ->assertStatus(204);

    $this->assertDatabaseMissing('system_announcements', ['id' => $announcement->id]);

    $this->assertDatabaseHas('platform_audit_logs', [
        'action' => 'system_announcement_deleted',
        'admin_user_id' => $admin->id,
    ]);
});

test('non_super_admin_cannot_delete_announcement', function () {
    $admin = makeAnnouncementAdmin('admin');
    $announcement = makeAnnouncement();

    $this->actingAs($admin, 'platform_admin')
        ->deleteJson("/api/platform/v1/system-announcements/{$announcement->id}")
        ->assertStatus(403);

    $this->assertDatabaseHas('system_announcements', ['id' => $announcement->id]);
});

test('platform_admin_index_returns_all_announcements_paginated', function () {
    $admin = makeAnnouncementAdmin('super_admin');

    makeAnnouncement(['title' => 'Active one', 'is_active' => true]);
    makeAnnouncement(['title' => 'Inactive one', 'is_active' => false]);

    $response = $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/system-announcements')
        ->assertStatus(200);

    expect($response->json('total'))->toBe(2);
});

test('platform_admin_index_filters_by_is_active', function () {
    $admin = makeAnnouncementAdmin('super_admin');

    makeAnnouncement(['is_active' => true]);
    makeAnnouncement(['is_active' => false]);

    $response = $this->actingAs($admin, 'platform_admin')
        ->getJson('/api/platform/v1/system-announcements?is_active=true')
        ->assertStatus(200);

    expect($response->json('total'))->toBe(1);
    expect($response->json('data.0.is_active'))->toBeTrue();
});
