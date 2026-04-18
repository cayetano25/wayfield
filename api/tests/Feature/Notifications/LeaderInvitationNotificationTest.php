<?php

use App\Domain\Leaders\Actions\AcceptLeaderInvitationAction;
use App\Domain\Leaders\Actions\DeclineLeaderInvitationAction;
use App\Jobs\SendLeaderInvitationNotificationJob;
use App\Models\LeaderInvitation;
use App\Models\Notification;
use App\Models\NotificationRecipient;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Services\Notification\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLeaderInviteFixture(): array
{
    $org = Organization::factory()->create();
    $admin = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id'         => $admin->id,
        'role'            => 'admin',
        'is_active'       => true,
    ]);
    $workshop = Workshop::factory()->forOrganization($org->id)->create();
    return [$org, $admin, $workshop];
}

function makePendingInvitation(Organization $org, User $invitedBy, string $invitedEmail, ?int $workshopId = null): array
{
    $rawToken = Str::random(64);
    $invitation = LeaderInvitation::create([
        'organization_id'       => $org->id,
        'workshop_id'           => $workshopId,
        'leader_id'             => null,
        'invited_email'         => $invitedEmail,
        'status'                => 'pending',
        'invitation_token_hash' => hash('sha256', $rawToken),
        'expires_at'            => now()->addDays(7),
        'created_by_user_id'    => $invitedBy->id,
    ]);
    return [$invitation, $rawToken];
}

// ─── Job dispatched when inviting ─────────────────────────────────────────────

test('invitation notification job is dispatched when inviting a leader', function () {
    Queue::fake();

    [$org, $admin, $workshop] = makeLeaderInviteFixture();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/v1/organizations/{$org->id}/leaders/invitations", [
            'invited_email'      => 'newleader@example.com',
            'invited_first_name' => 'Jane',
            'invited_last_name'  => 'Doe',
        ])
        ->assertStatus(201);

    Queue::assertPushed(SendLeaderInvitationNotificationJob::class);
});

// ─── Job skips in-app when no account exists ─────────────────────────────────

test('job does not create in-app notification when invited email has no account', function () {
    [$org, $admin] = makeLeaderInviteFixture();
    [$invitation, $rawToken] = makePendingInvitation($org, $admin, 'noone@example.com');

    $job = new SendLeaderInvitationNotificationJob($invitation->id, $rawToken);
    $job->handle(app(NotificationService::class));

    expect(NotificationRecipient::count())->toBe(0);
});

// ─── Job creates notification and recipient for existing user ─────────────────

test('job creates notification and recipient row for user with existing account', function () {
    [$org, $admin, $workshop] = makeLeaderInviteFixture();

    $existingUser = User::factory()->create(['email' => 'leader@example.com']);
    [$invitation, $rawToken] = makePendingInvitation($org, $admin, 'leader@example.com', $workshop->id);

    $job = new SendLeaderInvitationNotificationJob($invitation->id, $rawToken);
    $job->handle(app(NotificationService::class));

    $recipient = NotificationRecipient::where('user_id', $existingUser->id)->first();
    expect($recipient)->not->toBeNull();
    expect($recipient->in_app_status)->toBe('delivered');

    $notification = $recipient->notification;
    expect($notification->notification_category)->toBe('invitation');
    expect($notification->action_data['invitation_id'])->toBe($invitation->id);
    expect($notification->action_data['organization_name'])->toBe($org->name);
});

// ─── action_data contains required keys ──────────────────────────────────────

test('invitation notification action_data contains all required keys', function () {
    [$org, $admin, $workshop] = makeLeaderInviteFixture();

    $existingUser = User::factory()->create(['email' => 'leader2@example.com']);
    [$invitation, $rawToken] = makePendingInvitation($org, $admin, 'leader2@example.com', $workshop->id);

    $job = new SendLeaderInvitationNotificationJob($invitation->id, $rawToken);
    $job->handle(app(NotificationService::class));

    $notification = Notification::where('notification_category', 'invitation')->first();
    $data = $notification->action_data;

    expect($data)->toHaveKeys([
        'invitation_id', 'accept_token', 'decline_token',
        'organization_name', 'workshop_title', 'inviter_name',
        'accept_url', 'decline_url',
    ]);
    expect($data['invitation_id'])->toBe($invitation->id);
    expect($data['accept_token'])->toBe($rawToken);
});

// ─── Job is a no-op if invitation no longer exists ───────────────────────────

test('job is a no-op if invitation has been deleted', function () {
    $job = new SendLeaderInvitationNotificationJob(99999, Str::random(64));
    $job->handle(app(NotificationService::class)); // should not throw

    expect(NotificationRecipient::count())->toBe(0);
});

// ─── Accepting invitation clears in-app notification ─────────────────────────

test('accepting invitation marks in-app notification as read', function () {
    [$org, $admin, $workshop] = makeLeaderInviteFixture();

    $user = User::factory()->create(['email' => 'acceptme@example.com']);
    [$invitation, $rawToken] = makePendingInvitation($org, $admin, 'acceptme@example.com');

    // Create delivered in-app notification
    $notification = Notification::create([
        'organization_id'       => $org->id,
        'workshop_id'           => null,
        'created_by_user_id'    => null,
        'title'                 => 'Workshop Leader Invitation',
        'message'               => 'You have been invited.',
        'notification_type'     => 'informational',
        'notification_category' => 'invitation',
        'sender_scope'          => 'organizer',
        'delivery_scope'        => 'custom',
        'action_data'           => ['invitation_id' => $invitation->id],
        'sent_at'               => now(),
    ]);
    $recipient = NotificationRecipient::create([
        'notification_id' => $notification->id,
        'user_id'         => $user->id,
        'in_app_status'   => 'delivered',
        'read_at'         => null,
    ]);

    $action = app(AcceptLeaderInvitationAction::class);
    $action->execute($invitation, $user, [
        'first_name' => $user->first_name,
        'last_name'  => $user->last_name,
    ]);

    expect($recipient->fresh()->in_app_status)->toBe('read');
    expect($recipient->fresh()->read_at)->not->toBeNull();
});

// ─── Declining invitation clears in-app notification ─────────────────────────

test('declining invitation marks in-app notification as read', function () {
    [$org, $admin] = makeLeaderInviteFixture();

    $user = User::factory()->create(['email' => 'declineme@example.com']);
    [$invitation, $rawToken] = makePendingInvitation($org, $admin, 'declineme@example.com');

    $notification = Notification::create([
        'organization_id'       => $org->id,
        'workshop_id'           => null,
        'created_by_user_id'    => null,
        'title'                 => 'Workshop Leader Invitation',
        'message'               => 'You have been invited.',
        'notification_type'     => 'informational',
        'notification_category' => 'invitation',
        'sender_scope'          => 'organizer',
        'delivery_scope'        => 'custom',
        'action_data'           => ['invitation_id' => $invitation->id],
        'sent_at'               => now(),
    ]);
    $recipient = NotificationRecipient::create([
        'notification_id' => $notification->id,
        'user_id'         => $user->id,
        'in_app_status'   => 'delivered',
        'read_at'         => null,
    ]);

    $action = new DeclineLeaderInvitationAction();
    $action->execute($invitation, $user);

    expect($recipient->fresh()->in_app_status)->toBe('read');
    expect($recipient->fresh()->read_at)->not->toBeNull();
});

// ─── Unread count reflects invitation notifications ───────────────────────────

test('unread count includes unread invitation notifications', function () {
    [$org, $admin] = makeLeaderInviteFixture();

    $user = User::factory()->create(['email' => 'countme@example.com']);
    [$invitation, $rawToken] = makePendingInvitation($org, $admin, 'countme@example.com');

    $service = app(NotificationService::class);
    $service->createLeaderInvitationNotification([
        'invitation_id'     => $invitation->id,
        'accept_token'      => $rawToken,
        'decline_token'     => $rawToken,
        'invited_user_id'   => $user->id,
        'organization_id'   => $org->id,
        'organization_name' => $org->name,
        'workshop_title'    => null,
        'inviter_name'      => 'Admin User',
    ]);

    $count = $service->getUnreadCount($user->id);
    expect($count)->toBe(1);

    // Verify via API
    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/me/notifications/unread-count')
        ->assertStatus(200)
        ->assertJson(['unread_count' => 1]);
});
