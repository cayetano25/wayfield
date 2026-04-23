<?php

declare(strict_types=1);

use App\Domain\Sessions\Actions\AssignParticipantResult;
use App\Domain\Sessions\Actions\AssignParticipantToSessionAction;
use App\Domain\Sessions\Exceptions\SessionSelectionException;
use App\Models\AttendanceRecord;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function assignActionFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $participant = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create([
        'registration_status' => 'registered',
    ]);

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    return [$org, $workshop, $owner, $participant, $reg, $session];
}

// ─── Happy path ───────────────────────────────────────────────────────────────

test('assign creates selection with organizer_assigned source', function () {
    [, , $owner, $participant, , $session] = assignActionFixture();

    $result = app(AssignParticipantToSessionAction::class)->assign($session, $participant, $owner);

    expect($result)->toBeInstanceOf(AssignParticipantResult::class);
    expect($result->success)->toBeTrue();
    expect($result->sessionSelection->assignment_source)->toBe('organizer_assigned');
    expect($result->sessionSelection->assigned_by_user_id)->toBe($owner->id);
    expect($result->sessionSelection->assigned_at)->not->toBeNull();
});

test('assign stores optional assignment_notes', function () {
    [, , $owner, $participant, , $session] = assignActionFixture();

    $result = app(AssignParticipantToSessionAction::class)->assign(
        $session, $participant, $owner, ['assignment_notes' => 'VIP participant']
    );

    expect($result->sessionSelection->assignment_notes)->toBe('VIP participant');
});

test('assign creates attendance record for the participant', function () {
    [, , $owner, $participant, , $session] = assignActionFixture();

    app(AssignParticipantToSessionAction::class)->assign($session, $participant, $owner);

    expect(
        AttendanceRecord::where('session_id', $session->id)
            ->where('user_id', $participant->id)
            ->where('status', 'not_checked_in')
            ->exists()
    )->toBeTrue();
});

test('assign writes audit log with organizer_assigned action', function () {
    [$org, , $owner, $participant, , $session] = assignActionFixture();

    app(AssignParticipantToSessionAction::class)->assign($session, $participant, $owner);

    expect(
        AuditLog::where('organization_id', $org->id)
            ->where('actor_user_id', $owner->id)
            ->where('action', 'organizer_assigned')
            ->exists()
    )->toBeTrue();
});

// ─── Capacity: force_assign bypasses cap ──────────────────────────────────────

test('force_assign bypasses full capacity', function () {
    [$org, $workshop, $owner] = assignActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'capacity' => 1,
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    // Fill the one slot.
    $other = User::factory()->create();
    $otherReg = Registration::factory()->forWorkshop($workshop->id)->forUser($other->id)->create();
    app(AssignParticipantToSessionAction::class)->assign($session, $other, $owner, ['force_assign' => false]);

    // Force-assign a second participant over capacity.
    $extra = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($extra->id)->create();

    $result = app(AssignParticipantToSessionAction::class)->assign($session, $extra, $owner, ['force_assign' => true]);

    expect($result->success)->toBeTrue();
    expect(
        SessionSelection::where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->count()
    )->toBe(2);
});

test('assign at capacity without force_assign throws SESSION_AT_CAPACITY', function () {
    [$org, $workshop, $owner] = assignActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->addon()->create([
        'delivery_type' => 'in_person',
        'capacity' => 1,
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $other = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($other->id)->create();
    app(AssignParticipantToSessionAction::class)->assign($session, $other, $owner);

    $extra = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($extra->id)->create();

    expect(fn () => app(AssignParticipantToSessionAction::class)->assign($session, $extra, $owner))
        ->toThrow(\App\Domain\Sessions\Exceptions\SessionCapacityExceededException::class);
});

// ─── Schedule conflict → warning, not error ───────────────────────────────────

test('schedule conflict produces warning but still creates selection', function () {
    [$org, $workshop, $owner, $participant, $reg, $session] = assignActionFixture();

    // Create a conflicting session (same time slot) already selected.
    $conflictSession = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => $session->start_at,
        'end_at' => $session->end_at,
    ]);
    SessionSelection::factory()->selfSelected()->create([
        'registration_id' => $reg->id,
        'session_id' => $conflictSession->id,
    ]);

    $result = app(AssignParticipantToSessionAction::class)->assign($session, $participant, $owner);

    expect($result->success)->toBeTrue();
    expect($result->warnings)->not->toBeEmpty();
    expect($result->warnings[0]['code'])->toBe('WARN_SCHEDULE_CONFLICT');
});

// ─── Upsert behavior ──────────────────────────────────────────────────────────

test('assign upserts over a canceled selection row', function () {
    [, , $owner, $participant, $reg, $session] = assignActionFixture();

    // Pre-create a canceled row.
    $canceled = SessionSelection::factory()->canceled()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    app(AssignParticipantToSessionAction::class)->assign($session, $participant, $owner);

    $updated = $canceled->fresh();
    expect($updated->selection_status)->toBe('selected');
    expect($updated->assignment_source)->toBe('organizer_assigned');
    // Only one row should exist.
    expect(
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $session->id)
            ->count()
    )->toBe(1);
});

// ─── Not registered ───────────────────────────────────────────────────────────

test('assign throws when participant is not registered for workshop', function () {
    [, , $owner, , , $session] = assignActionFixture();

    $unregistered = User::factory()->create();

    expect(fn () => app(AssignParticipantToSessionAction::class)->assign($session, $unregistered, $owner))
        ->toThrow(\InvalidArgumentException::class);
});

// ─── Unpublished session ──────────────────────────────────────────────────────

test('assign throws SESSION_NOT_PUBLISHED for draft session', function () {
    [$org, $workshop, $owner] = assignActionFixture();

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $session = Session::factory()->forWorkshop($workshop->id)->draft()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    try {
        app(AssignParticipantToSessionAction::class)->assign($session, $participant, $owner);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_NOT_PUBLISHED);
    }
});
