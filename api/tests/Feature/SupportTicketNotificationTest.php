<?php

use App\Jobs\SendSupportTicketReplyJob;
use App\Mail\SupportTicketReplyMail;
use App\Models\AdminUser;
use App\Models\Organization;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSupportAdmin(): AdminUser
{
    static $seq = 0;
    $seq++;

    return AdminUser::create([
        'first_name'    => 'Support',
        'last_name'     => "Agent{$seq}",
        'email'         => "agent{$seq}@wayfield.internal",
        'password_hash' => Hash::make('password'),
        'role'          => 'support',
        'is_active'     => true,
    ]);
}

function makeTicketWithUser(): array
{
    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    $org = Organization::factory()->create();

    $ticket = SupportTicket::create([
        'organization_id'     => $org->id,
        'submitted_by_user_id' => $user->id,
        'subject'             => 'Help with my workshop',
        'body'                => 'I need help.',
        'status'              => 'open',
        'priority'            => 'normal',
        'category'            => 'general',
        'source'              => 'web',
    ]);

    return [$user, $ticket];
}

// ─── Reply dispatch ───────────────────────────────────────────────────────────

test('adding a non-internal message dispatches SendSupportTicketReplyJob', function () {
    Queue::fake();

    $admin = makeSupportAdmin();
    [, $ticket] = makeTicketWithUser();

    $this->actingAs($admin, 'platform_admin')
        ->postJson("/api/platform/v1/support/tickets/{$ticket->id}/messages", [
            'body'        => 'Here is the answer to your question.',
            'is_internal' => false,
        ])
        ->assertStatus(201);

    Queue::assertPushed(SendSupportTicketReplyJob::class, function ($job) use ($ticket) {
        return $job->ticketId === $ticket->id;
    });
});

test('adding an internal note does not dispatch reply job', function () {
    Queue::fake();

    $admin = makeSupportAdmin();
    [, $ticket] = makeTicketWithUser();

    $this->actingAs($admin, 'platform_admin')
        ->postJson("/api/platform/v1/support/tickets/{$ticket->id}/messages", [
            'body'        => 'Internal note for team only.',
            'is_internal' => true,
        ])
        ->assertStatus(201);

    Queue::assertNotPushed(SendSupportTicketReplyJob::class);
});

// ─── Job behaviour ────────────────────────────────────────────────────────────

test('SendSupportTicketReplyJob queues email to ticket submitter', function () {
    Mail::fake();

    [$user, $ticket] = makeTicketWithUser();

    $message = $ticket->messages()->create([
        'sender_user_id' => null,
        'body'           => 'We have resolved your issue.',
        'is_internal'    => false,
    ]);

    SendSupportTicketReplyJob::dispatchSync($ticket->id, $message->id);

    Mail::assertQueued(SupportTicketReplyMail::class, function ($mail) use ($user, $ticket) {
        return $mail->hasTo($user->email)
            && str_contains($mail->envelope()->subject, (string) $ticket->id);
    });
});

test('SendSupportTicketReplyJob does not send for internal messages', function () {
    Mail::fake();

    [, $ticket] = makeTicketWithUser();

    $message = $ticket->messages()->create([
        'sender_user_id' => null,
        'body'           => 'Internal note.',
        'is_internal'    => true,
    ]);

    SendSupportTicketReplyJob::dispatchSync($ticket->id, $message->id);

    Mail::assertNothingQueued();
});

test('SupportTicketReplyMail subject contains ticket ID', function () {
    Mail::fake();

    [$user, $ticket] = makeTicketWithUser();

    $message = $ticket->messages()->create([
        'sender_user_id' => null,
        'body'           => 'Reply body.',
        'is_internal'    => false,
    ]);

    SendSupportTicketReplyJob::dispatchSync($ticket->id, $message->id);

    Mail::assertQueued(SupportTicketReplyMail::class, function ($mail) use ($ticket) {
        return str_contains($mail->envelope()->subject, "#{$ticket->id}");
    });
});

test('job handles missing ticket gracefully', function () {
    Mail::fake();

    // Should not throw
    SendSupportTicketReplyJob::dispatchSync(999999, 999999);

    Mail::assertNothingSent();
});
