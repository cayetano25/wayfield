<?php

declare(strict_types=1);

use App\Domain\Sessions\Actions\RemoveParticipantFromSessionAction;
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

function removeActionFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create();

    $owner = User::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $owner->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $participant = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $selection = SessionSelection::factory()->selfSelected()->create([
        'registration_id' => $reg->id,
        'session_id' => $session->id,
    ]);

    return [$org, $workshop, $owner, $participant, $reg, $session, $selection];
}

// ─── Happy path ───────────────────────────────────────────────────────────────

test('remove cancels the selection row', function () {
    [, , $owner, $participant, , $session, $selection] = removeActionFixture();

    app(RemoveParticipantFromSessionAction::class)->remove($session, $participant, $owner);

    expect($selection->fresh()->selection_status)->toBe('canceled');
});

test('remove does not delete the row', function () {
    [, , $owner, $participant, , $session, $selection] = removeActionFixture();

    app(RemoveParticipantFromSessionAction::class)->remove($session, $participant, $owner);

    expect(SessionSelection::find($selection->id))->not->toBeNull();
});

test('remove writes audit log with organizer_removed action', function () {
    [$org, , $owner, $participant, , $session, $selection] = removeActionFixture();

    app(RemoveParticipantFromSessionAction::class)->remove($session, $participant, $owner);

    expect(
        AuditLog::where('organization_id', $org->id)
            ->where('actor_user_id', $owner->id)
            ->where('action', 'organizer_removed')
            ->where('entity_type', 'session_selection')
            ->where('entity_id', $selection->id)
            ->exists()
    )->toBeTrue();
});

test('audit log metadata includes previous selection status', function () {
    [$org, , $owner, $participant, , $session] = removeActionFixture();

    app(RemoveParticipantFromSessionAction::class)->remove($session, $participant, $owner);

    $log = AuditLog::where('organization_id', $org->id)
        ->where('action', 'organizer_removed')
        ->latest()
        ->first();

    expect($log->metadata_json['previous_selection_status'])->toBe('selected');
});

test('audit log metadata includes optional reason', function () {
    [$org, , $owner, $participant, , $session] = removeActionFixture();

    app(RemoveParticipantFromSessionAction::class)->remove(
        $session, $participant, $owner, ['reason' => 'No-show history']
    );

    $log = AuditLog::where('organization_id', $org->id)
        ->where('action', 'organizer_removed')
        ->latest()
        ->first();

    expect($log->metadata_json['reason'])->toBe('No-show history');
});

// ─── Error cases ──────────────────────────────────────────────────────────────

test('throws InvalidArgumentException when participant is not registered', function () {
    [, , $owner, , , $session] = removeActionFixture();

    $outsider = User::factory()->create();

    expect(fn () => app(RemoveParticipantFromSessionAction::class)->remove($session, $outsider, $owner))
        ->toThrow(\InvalidArgumentException::class);
});

test('throws InvalidArgumentException when participant is not selected for the session', function () {
    [$org, $workshop, $owner] = removeActionFixture();

    $participant = User::factory()->create();
    Registration::factory()->forWorkshop($workshop->id)->forUser($participant->id)->create();
    // No selection row.

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    expect(fn () => app(RemoveParticipantFromSessionAction::class)->remove($session, $participant, $owner))
        ->toThrow(\InvalidArgumentException::class);
});

test('throws InvalidArgumentException when selection is already canceled', function () {
    [, , $owner, $participant, , $session, $selection] = removeActionFixture();

    // Cancel the existing selection row.
    $selection->update(['selection_status' => 'canceled']);

    expect(fn () => app(RemoveParticipantFromSessionAction::class)->remove($session, $participant, $owner))
        ->toThrow(\InvalidArgumentException::class);
});
