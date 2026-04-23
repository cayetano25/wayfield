<?php

declare(strict_types=1);

use App\Domain\Sessions\Actions\SelectSessionAction;
use App\Domain\Sessions\Exceptions\SessionSelectionException;
use App\Models\Organization;
use App\Models\Registration;
use App\Models\Session;
use App\Models\SessionSelection;
use App\Models\User;
use App\Models\Workshop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function selectActionFixture(): array
{
    $org = Organization::factory()->create();
    $workshop = Workshop::factory()->sessionBased()->forOrganization($org->id)->published()->create([
        'timezone' => 'America/New_York',
    ]);
    $user = User::factory()->create();
    $reg = Registration::factory()->forWorkshop($workshop->id)->forUser($user->id)->create([
        'registration_status' => 'registered',
    ]);

    return [$org, $workshop, $user, $reg];
}

// ─── Gate 2: publication_status ───────────────────────────────────────────────

test('throws SESSION_NOT_PUBLISHED for draft session', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->draft()->create([
        'participant_visibility' => 'visible',
        'enrollment_mode' => 'self_select',
        'delivery_type' => 'in_person',
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_NOT_PUBLISHED);
    }
});

// ─── Gate 3: participant_visibility ───────────────────────────────────────────

test('throws SESSION_NOT_VISIBLE_FOR_SELECTION for hidden session', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'publication_status' => 'published',
        'is_published' => true,
        'participant_visibility' => 'hidden',
        'enrollment_mode' => 'self_select',
        'delivery_type' => 'in_person',
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_NOT_VISIBLE_FOR_SELECTION);
    }
});

test('throws SESSION_NOT_VISIBLE_FOR_SELECTION for invite_only session', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'publication_status' => 'published',
        'is_published' => true,
        'participant_visibility' => 'invite_only',
        'enrollment_mode' => 'self_select',
        'delivery_type' => 'in_person',
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_NOT_VISIBLE_FOR_SELECTION);
    }
});

// ─── Gate 4: enrollment_mode ──────────────────────────────────────────────────

test('throws SESSION_NOT_SELF_SELECTABLE for organizer_assign_only', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->organizerOnly()->create([
        'delivery_type' => 'in_person',
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_NOT_SELF_SELECTABLE);
    }
});

test('throws SESSION_NOT_SELF_SELECTABLE for purchase_required enrollment mode', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->create([
        'publication_status' => 'published',
        'is_published' => true,
        'participant_visibility' => 'visible',
        'enrollment_mode' => 'purchase_required',
        'delivery_type' => 'in_person',
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_NOT_SELF_SELECTABLE);
    }
});

// ─── Gate: selection window ───────────────────────────────────────────────────

test('throws SESSION_SELECTION_WINDOW_CLOSED when window has not opened', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'selection_opens_at' => now()->addDays(7)->toIso8601String(),
        'selection_closes_at' => now()->addDays(14)->toIso8601String(),
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_SELECTION_WINDOW_CLOSED);
    }
});

test('throws SESSION_SELECTION_WINDOW_CLOSED when window has closed', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'selection_opens_at' => now()->subDays(14)->toIso8601String(),
        'selection_closes_at' => now()->subDays(7)->toIso8601String(),
    ]);

    try {
        app(SelectSessionAction::class)->execute($reg, $session);
        $this->fail('Expected SessionSelectionException to be thrown.');
    } catch (SessionSelectionException $e) {
        expect($e->getErrorCode())->toBe(SessionSelectionException::SESSION_SELECTION_WINDOW_CLOSED);
    }
});

test('succeeds when selection is within the open window', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
        'selection_opens_at' => now()->subDay()->toIso8601String(),
        'selection_closes_at' => now()->addDay()->toIso8601String(),
    ]);

    $result = app(SelectSessionAction::class)->execute($reg, $session);

    expect($result)->toBeInstanceOf(SessionSelection::class);
    expect($result->selection_status)->toBe('selected');
    expect($result->assignment_source)->toBe('self_selected');
});

// ─── No window = no restriction ───────────────────────────────────────────────

test('succeeds with no selection window configured', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
        'selection_opens_at' => null,
        'selection_closes_at' => null,
    ]);

    $result = app(SelectSessionAction::class)->execute($reg, $session);

    expect($result->assignment_source)->toBe('self_selected');
    expect($result->assigned_by_user_id)->toBeNull();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

test('creates selection row with self_selected assignment_source', function () {
    [, $workshop, $user, $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    app(SelectSessionAction::class)->execute($reg, $session);

    expect(
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $session->id)
            ->where('selection_status', 'selected')
            ->where('assignment_source', 'self_selected')
            ->exists()
    )->toBeTrue();
});

test('idempotent: re-selecting an already selected session returns existing row', function () {
    [, $workshop, , $reg] = selectActionFixture();

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    $first = app(SelectSessionAction::class)->execute($reg, $session);
    $second = app(SelectSessionAction::class)->execute($reg, $session);

    expect($first->id)->toBe($second->id);
    expect(
        SessionSelection::where('registration_id', $reg->id)
            ->where('session_id', $session->id)
            ->count()
    )->toBe(1);
});

// ─── Inactive registration ─────────────────────────────────────────────────────

test('throws InvalidArgumentException for removed registration', function () {
    [, $workshop, , $reg] = selectActionFixture();
    $reg->update(['registration_status' => 'removed']);

    $session = Session::factory()->forWorkshop($workshop->id)->standard()->create([
        'delivery_type' => 'in_person',
        'start_at' => now()->addMonth(),
        'end_at' => now()->addMonth()->addHours(2),
    ]);

    expect(fn () => app(SelectSessionAction::class)->execute($reg, $session))
        ->toThrow(\InvalidArgumentException::class);
});
