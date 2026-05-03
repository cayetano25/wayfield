<?php

declare(strict_types=1);

use App\Domain\Notifications\Services\EnforceLeaderMessagingRulesService;
use App\Exceptions\LeaderMessagingDeniedException;
use App\Models\AuditLog;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\Session;
use App\Models\SessionLeader;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Workshop;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Time-window boundary tests for EnforceLeaderMessagingRulesService::validate().
 *
 * All window tests use Asia/Tokyo (UTC+9) deliberately.
 * A test that only passes with UTC-equivalent math would also pass with broken
 * timezone logic. Tokyo forces real timezone conversion.
 *
 * Tokyo session: 10:00–12:00 JST = 01:00–03:00 UTC on 2026-01-15
 * Messaging window: 06:00–14:00 JST = 21:00 UTC (2026-01-14) – 05:00 UTC (2026-01-15)
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal fixture for service-level window tests.
 *
 * Returns [service, user, leader, session].
 * The org has a Starter subscription (plan gate passes).
 * The leader is assigned to the session (scope check passes).
 * Default timezone: Asia/Tokyo.
 */
function wmFixture(string $timezone = 'Asia/Tokyo'): array
{
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->creator()->active()->create();

    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => $timezone]);

    // Session 10:00–12:00 JST → 01:00–03:00 UTC
    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'delivery_type' => 'in_person',
            'start_at' => '2026-01-15 01:00:00', // 10:00 JST
            'end_at' => '2026-01-15 03:00:00', // 12:00 JST
        ]);

    $user = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $user->id]);

    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    $service = app(EnforceLeaderMessagingRulesService::class);

    return compact('service', 'user', 'leader', 'session');
}

/** Freeze Carbon to a UTC datetime string. */
function wmFreeze(string $utc): void
{
    Carbon::setTestNow(Carbon::parse($utc, 'UTC'));
}

/** Reset Carbon to real time. */
function wmThaw(): void
{
    Carbon::setTestNow();
}

// ─── getWindow() ──────────────────────────────────────────────────────────────

test('getWindow returns correct JST boundaries for a Tokyo session', function () {
    ['service' => $service, 'session' => $session] = wmFixture('Asia/Tokyo');

    $window = $service->getWindow($session);

    // session start 10:00 JST → window start 06:00 JST
    expect($window['start']->format('H:i'))->toBe('06:00');
    // session end   12:00 JST → window end   14:00 JST
    expect($window['end']->format('H:i'))->toBe('14:00');
    // Both should be in the Tokyo timezone
    expect($window['start']->timezoneName)->toBe('Asia/Tokyo');
    expect($window['end']->timezoneName)->toBe('Asia/Tokyo');
});

// ─── Window boundary: open edge ───────────────────────────────────────────────

test('validate() allows notification sent exactly at window start (06:00 JST = 21:00 UTC)', function () {
    ['service' => $service, 'user' => $user, 'session' => $session] = wmFixture();

    // 06:00 JST = 21:00 UTC on the previous calendar day (2026-01-14)
    wmFreeze('2026-01-14 21:00:00');

    expect(fn () => $service->validate($user, $session))->not->toThrow(LeaderMessagingDeniedException::class);

    wmThaw();
});

test('validate() denies notification sent 1 minute before window opens (05:59 JST = 20:59 UTC)', function () {
    ['service' => $service, 'user' => $user, 'session' => $session] = wmFixture();

    // 05:59 JST = 20:59 UTC on 2026-01-14 → outside window
    wmFreeze('2026-01-14 20:59:00');

    expect(fn () => $service->validate($user, $session))
        ->toThrow(LeaderMessagingDeniedException::class);

    wmThaw();
});

// ─── Window boundary: close edge ─────────────────────────────────────────────

test('validate() allows notification sent exactly at window end (14:00 JST = 05:00 UTC)', function () {
    ['service' => $service, 'user' => $user, 'session' => $session] = wmFixture();

    // 14:00 JST = 05:00 UTC on 2026-01-15
    wmFreeze('2026-01-15 05:00:00');

    expect(fn () => $service->validate($user, $session))->not->toThrow(LeaderMessagingDeniedException::class);

    wmThaw();
});

test('validate() denies notification sent 1 minute after window closes (14:01 JST = 05:01 UTC)', function () {
    ['service' => $service, 'user' => $user, 'session' => $session] = wmFixture();

    // 14:01 JST = 05:01 UTC on 2026-01-15 → outside window
    wmFreeze('2026-01-15 05:01:00');

    expect(fn () => $service->validate($user, $session))
        ->toThrow(LeaderMessagingDeniedException::class);

    wmThaw();
});

// ─── Timezone correctness ─────────────────────────────────────────────────────

test('validate() uses workshop timezone — UTC offset wrong but JST window correct passes', function () {
    // This test would FAIL if the service compared UTC times directly.
    // At 21:30 UTC (= 06:30 JST), the window is open in Tokyo.
    // If the service used UTC for the session's 01:00 UTC start, the window
    // would start at 21:00 UTC — and 21:30 would pass either way.
    // We verify that the service reports the window in JST by checking getWindow().
    ['service' => $service, 'user' => $user, 'session' => $session] = wmFixture('Asia/Tokyo');

    wmFreeze('2026-01-14 21:30:00'); // 06:30 JST — inside Tokyo window

    // Should pass (inside window)
    expect(fn () => $service->validate($user, $session))->not->toThrow(LeaderMessagingDeniedException::class);

    // Verify window is expressed in JST, not UTC
    $window = $service->getWindow($session);
    expect($window['start']->timezoneName)->toBe('Asia/Tokyo');
    expect($window['start']->hour)->toBe(6);  // 06:xx JST, not 21:xx UTC

    wmThaw();
});

// ─── Plan gate ────────────────────────────────────────────────────────────────

test('validate() throws plan_required with required_plan starter when org is on free plan', function () {
    $org = Organization::factory()->create();
    // Free plan — no Starter subscription
    Subscription::factory()->forOrganization($org->id)->foundation()->active()->create();

    $workshop = Workshop::factory()
        ->forOrganization($org->id)
        ->published()
        ->sessionBased()
        ->create(['timezone' => 'America/Chicago']);

    $session = Session::factory()
        ->forWorkshop($workshop->id)
        ->published()
        ->create([
            'start_at' => '2026-01-15 16:00:00',
            'end_at' => '2026-01-15 18:00:00',
        ]);

    $user = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $user->id]);
    SessionLeader::factory()->create([
        'session_id' => $session->id,
        'leader_id' => $leader->id,
        'assignment_status' => 'accepted',
    ]);

    wmFreeze('2026-01-15 17:00:00'); // inside window if plan allowed it

    $service = app(EnforceLeaderMessagingRulesService::class);

    try {
        $service->validate($user, $session);
        $this->fail('Expected LeaderMessagingDeniedException was not thrown');
    } catch (LeaderMessagingDeniedException $e) {
        expect($e->getErrorCode())->toBe('plan_required');
        expect($e->getResponseData()['required_plan'])->toBe('creator');
    } finally {
        wmThaw();
    }
});

// ─── Audit logging ────────────────────────────────────────────────────────────

test('validate() writes a denied audit log when the window is missed', function () {
    ['service' => $service, 'user' => $user, 'session' => $session] = wmFixture();

    // Before window opens
    wmFreeze('2026-01-14 20:59:00'); // 05:59 JST

    try {
        $service->validate($user, $session);
    } catch (LeaderMessagingDeniedException) {
        // expected
    }

    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $user->id,
        'entity_type' => 'session',
        'entity_id' => $session->id,
        'action' => 'leader_notification_denied',
    ]);

    $log = AuditLog::where('action', 'leader_notification_denied')
        ->where('actor_user_id', $user->id)
        ->first();

    expect($log->metadata_json['denial_reason'])->toBe('outside_window');

    wmThaw();
});

test('validate() writes an allowed audit log when all checks pass', function () {
    ['service' => $service, 'user' => $user, 'leader' => $leader, 'session' => $session] = wmFixture();

    // Inside window — 07:00 JST = 22:00 UTC on 2026-01-14
    wmFreeze('2026-01-14 22:00:00');

    $service->validate($user, $session);

    $this->assertDatabaseHas('audit_logs', [
        'actor_user_id' => $user->id,
        'entity_type' => 'session',
        'entity_id' => $session->id,
        'action' => 'leader_notification_allowed',
    ]);

    $log = AuditLog::where('action', 'leader_notification_allowed')
        ->where('actor_user_id', $user->id)
        ->first();

    expect($log->metadata_json['leader_id'])->toBe($leader->id);
    expect($log->metadata_json['session_id'])->toBe($session->id);

    wmThaw();
});
