<?php

use App\Domain\Leaders\Actions\AcceptLeaderInvitationAction;
use App\Domain\Workshops\Actions\CreateWorkshopAction;
use App\Domain\Workshops\Actions\UpdateWorkshopAction;
use App\Models\Leader;
use App\Models\LeaderInvitation;
use App\Models\Organization;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

// ─── Workshop slug generation ─────────────────────────────────────────────────

test('creating_a_workshop_generates_a_public_slug', function () {
    [$user, $org] = makeOwner();

    $workshop = app(CreateWorkshopAction::class)->execute($org, [
        'workshop_type' => 'session_based',
        'title' => 'Pacific Northwest Photography',
        'description' => 'A beautiful retreat.',
        'timezone' => 'America/Los_Angeles',
        'start_date' => '2027-06-01',
        'end_date' => '2027-06-05',
    ]);

    expect($workshop->public_slug)->not->toBeNull();
    expect($workshop->public_slug)->toContain('pacific-northwest-photography');
});

test('slug_is_unique_when_two_workshops_have_same_title', function () {
    [$user, $org] = makeOwner();

    $data = [
        'workshop_type' => 'session_based',
        'title' => 'Portrait Workshop',
        'description' => 'First workshop.',
        'timezone' => 'America/New_York',
        'start_date' => '2027-07-01',
        'end_date' => '2027-07-03',
    ];

    $first = app(CreateWorkshopAction::class)->execute($org, $data);
    $second = app(CreateWorkshopAction::class)->execute($org, array_merge($data, [
        'description' => 'Second workshop.',
    ]));

    expect($first->public_slug)->not->toBe($second->public_slug);
    expect($first->public_slug)->not->toBeNull();
    expect($second->public_slug)->not->toBeNull();
});

test('updating_workshop_title_does_not_change_existing_slug', function () {
    [$user, $org] = makeOwner();

    $workshop = Workshop::factory()->forOrganization($org->id)->create([
        'title' => 'Original Title',
        'public_slug' => 'original-title',
        'status' => 'draft',
    ]);

    app(UpdateWorkshopAction::class)->execute($workshop, [
        'title' => 'Completely Different New Title',
    ]);

    $workshop->refresh();

    // Slug must remain unchanged — slugs are immutable after creation
    expect($workshop->public_slug)->toBe('original-title');
});

// ─── Leader slug generation ───────────────────────────────────────────────────

test('accepting_leader_invitation_generates_leader_slug', function () {
    Queue::fake();

    $user = User::factory()->create([
        'first_name' => 'Jane',
        'last_name' => 'Doe',
    ]);

    $org = Organization::factory()->create();

    $invitation = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->create([
            'invited_email' => $user->email,
            'invited_first_name' => 'Jane',
            'invited_last_name' => 'Doe',
            'status' => 'pending',
        ]);

    $leader = app(AcceptLeaderInvitationAction::class)->execute(
        $invitation,
        $user,
        ['first_name' => 'Jane', 'last_name' => 'Doe'],
    );

    $leader->refresh();

    expect($leader->slug)->not->toBeNull();
    expect($leader->slug)->toContain('jane');
});

test('leader_slug_is_not_overwritten_on_second_acceptance', function () {
    Queue::fake();

    $user = User::factory()->create([
        'first_name' => 'Sam',
        'last_name' => 'Smith',
    ]);

    $org = Organization::factory()->create();
    $org2 = Organization::factory()->create();

    // First invitation from org1
    $invitation1 = LeaderInvitation::factory()
        ->forOrganization($org->id)
        ->create([
            'invited_email' => $user->email,
            'invited_first_name' => 'Sam',
            'invited_last_name' => 'Smith',
            'status' => 'pending',
        ]);

    $leader = app(AcceptLeaderInvitationAction::class)->execute(
        $invitation1,
        $user,
        ['first_name' => 'Sam', 'last_name' => 'Smith'],
    );

    $leader->refresh();
    $originalSlug = $leader->slug;

    expect($originalSlug)->not->toBeNull();

    // Second invitation from org2 — same user, different org
    $invitation2 = LeaderInvitation::factory()
        ->forOrganization($org2->id)
        ->create([
            'invited_email' => $user->email,
            'invited_first_name' => 'Sam',
            'invited_last_name' => 'Smith',
            'status' => 'pending',
        ]);

    app(AcceptLeaderInvitationAction::class)->execute(
        $invitation2,
        $user,
        ['first_name' => 'Sam', 'last_name' => 'Smith'],
    );

    $leader->refresh();

    // Slug must be unchanged after second acceptance
    expect($leader->slug)->toBe($originalSlug);
});
