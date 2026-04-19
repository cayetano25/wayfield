<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class)->in('Feature');

// ─── Global Nominatim guard ────────────────────────────────────────────────────
//
// AddressObserver dispatches GeocodeAddressJob on every Address save.
// With QUEUE_CONNECTION=sync (used in tests), that job runs inline and
// would make real HTTP calls to Nominatim unless faked.
//
// This default fake returns an empty array (no results = "miss") for all
// Nominatim requests. Individual geocoding tests override this with their
// own Http::fake() calls, which replace this default and reset request history.
beforeEach(function () {
    Http::fake([
        'https://nominatim.openstreetmap.org/*' => Http::response([], 200),
    ]);
})->in('Feature');

// ─── Shared test helpers ───────────────────────────────────────────────────────

function makeOwner(): array
{
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    return [$user, $org];
}

function makeStaff(): array
{
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'staff',
        'is_active' => true,
    ]);

    return [$user, $org];
}
