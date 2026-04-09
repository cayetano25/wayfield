<?php

use App\Http\Resources\PublicLeaderResource;
use App\Models\Address;
use App\Models\Leader;
use App\Models\Location;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLogistics;
use App\Services\Address\AddressService;
use Illuminate\Artisan\Command;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;

uses(RefreshDatabase::class);

// ══════════════════════════════════════════════════════════════
// AddressService unit tests
// ══════════════════════════════════════════════════════════════

test('infers US from US timezone', function () {
    $service = app(AddressService::class);
    expect($service->inferCountryFromTimezone('America/New_York'))->toBe('US');
});

test('infers CA from Canadian timezone', function () {
    $service = app(AddressService::class);
    expect($service->inferCountryFromTimezone('America/Toronto'))->toBe('CA');
});

test('infers GB from London timezone', function () {
    $service = app(AddressService::class);
    expect($service->inferCountryFromTimezone('Europe/London'))->toBe('GB');
});

test('falls back to US for unknown timezone', function () {
    $service = app(AddressService::class);
    expect($service->inferCountryFromTimezone('Bogus/Timezone'))->toBe('US');
});

test('validates US postal code 12345 as true', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('12345', 'US'))->toBeTrue();
});

test('validates US postal code 12345-6789 as true', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('12345-6789', 'US'))->toBeTrue();
});

test('validates US postal code 1234 as false', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('1234', 'US'))->toBeFalse();
});

test('validates US postal code ABCDE as false', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('ABCDE', 'US'))->toBeFalse();
});

test('validates Canadian postal code K1A 0A6 as true', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('K1A 0A6', 'CA'))->toBeTrue();
});

test('validates Canadian postal code K1A0A6 as true — space is optional', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('K1A0A6', 'CA'))->toBeTrue();
});

test('validates Canadian postal code 12345 as false', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('12345', 'CA'))->toBeFalse();
});

test('validates UK postcode SW1A 2AA as true', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('SW1A 2AA', 'GB'))->toBeTrue();
});

test('validates UK postcode EC1A 1BB as true', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('EC1A 1BB', 'GB'))->toBeTrue();
});

test('validates UK postcode 12345 as false', function () {
    $service = app(AddressService::class);
    expect($service->validatePostalCode('12345', 'GB'))->toBeFalse();
});

test('accepts any format for country without postal validation rule', function () {
    $service = app(AddressService::class);
    // Singapore — null format rule
    expect($service->validatePostalCode('238801', 'SG'))->toBeTrue();
    expect($service->validatePostalCode('ANYTHING', 'SG'))->toBeTrue();
});

test('postal code stored as string preserving leading zeros', function () {
    $address = Address::create([
        'country_code' => 'US',
        'address_line_1' => '123 Main St',
        'postal_code' => '01234',
    ]);

    expect($address->fresh()->postal_code)->toBe('01234');
});

test('buildFormattedAddress produces correct US format', function () {
    $service = app(AddressService::class);
    $result = $service->buildFormattedAddress([
        'address_line_1' => '123 Main St',
        'address_line_2' => null,
        'locality' => 'Portland',
        'administrative_area' => 'OR',
        'postal_code' => '97201',
        'country_code' => 'US',
    ], 'US');

    expect($result)->toContain('123 Main St')
        ->and($result)->toContain('Portland')
        ->and($result)->toContain('OR')
        ->and($result)->toContain('97201');
});

test('buildFormattedAddress produces correct UK format', function () {
    $service = app(AddressService::class);
    $result = $service->buildFormattedAddress([
        'address_line_1' => '10 Downing Street',
        'address_line_2' => null,
        'locality' => 'London',
        'administrative_area' => null,
        'postal_code' => 'SW1A 2AA',
        'country_code' => 'GB',
    ], 'GB');

    expect($result)->toContain('London')
        ->and($result)->toContain('SW1A 2AA');
});

test('buildFormattedAddress produces correct Canada format', function () {
    $service = app(AddressService::class);
    $result = $service->buildFormattedAddress([
        'address_line_1' => '200 King St W',
        'address_line_2' => null,
        'locality' => 'Toronto',
        'administrative_area' => 'ON',
        'postal_code' => 'M5H 3T4',
        'country_code' => 'CA',
    ], 'CA');

    expect($result)->toContain('200 King St W')
        ->and($result)->toContain('Toronto')
        ->and($result)->toContain('ON')
        ->and($result)->toContain('M5H 3T4');
});

// ══════════════════════════════════════════════════════════════
// Address API endpoint tests
// ══════════════════════════════════════════════════════════════

test('countries endpoint returns at least 20 countries', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/address/countries');

    $response->assertStatus(200);
    expect(count($response->json()))->toBeGreaterThanOrEqual(20);
});

test('country endpoint returns correct config for CA', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/address/countries/CA');

    $response->assertStatus(200)
        ->assertJsonPath('postal_code_label', 'Postal Code');

    expect($response->json('administrative_area_options'))->not->toBeNull();
});

test('country endpoint returns 404 for unknown code', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/address/countries/XX')
        ->assertStatus(404);
});

test('infer-country endpoint returns CA for America/Toronto', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/address/infer-country?timezone=America/Toronto');

    $response->assertStatus(200)
        ->assertJsonPath('country_code', 'CA')
        ->assertJsonPath('country_name', 'Canada');
});

test('infer-country returns US for unknown timezone', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/address/infer-country?timezone=bogus');

    $response->assertStatus(200)
        ->assertJsonPath('country_code', 'US');
});

// ══════════════════════════════════════════════════════════════
// Location address integration
// ══════════════════════════════════════════════════════════════

test('location create with address data creates address row and links address_id', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id' => $user->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $beforeCount = Address::count();

    $response = $this->actingAs($user, 'sanctum')
        ->postJson("/api/v1/organizations/{$organization->id}/locations", [
            'name' => 'Main Venue',
            'address' => [
                'country_code' => 'US',
                'address_line_1' => '123 Main St',
                'locality' => 'Portland',
                'administrative_area' => 'OR',
                'postal_code' => '97201',
            ],
        ]);

    $response->assertStatus(201);

    $location = Location::latest()->first();
    expect($location->address_id)->not->toBeNull();
    expect(Address::count())->toBe($beforeCount + 1);
});

test('location get response includes address object', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id' => $user->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    Location::factory()->create(['organization_id' => $organization->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$organization->id}/locations");

    $response->assertStatus(200);
    expect($response->json('0'))->toHaveKey('address');
});

// ══════════════════════════════════════════════════════════════
// Leader profile address integration
// ══════════════════════════════════════════════════════════════

test('leader profile update creates and links address', function () {
    $user = User::factory()->create();
    $leader = Leader::factory()->create(['user_id' => $user->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->patchJson('/api/v1/leader/profile', [
            'address' => [
                'country_code' => 'US',
                'address_line_1' => '456 Oak Ave',
                'locality' => 'Seattle',
                'administrative_area' => 'WA',
                'postal_code' => '98101',
            ],
        ]);

    $response->assertStatus(200);

    $leader->refresh();
    expect($leader->address_id)->not->toBeNull();
});

test('public leader endpoint does not expose address_line_1', function () {
    // Verify that PublicLeaderResource omits private address fields.
    // We test the resource directly by inspecting its output.
    $address = Address::create([
        'country_code' => 'US',
        'address_line_1' => '123 Private Lane',
        'locality' => 'Seattle',
        'administrative_area' => 'WA',
        'postal_code' => '98101',
    ]);

    $leader = Leader::factory()->create([
        'address_id' => $address->id,
        'city' => 'Seattle',
        'state_or_region' => 'WA',
    ]);

    $resource = new PublicLeaderResource($leader);
    $request = Request::create('/');
    $resourceData = $resource->toArray($request);

    // address_line_1 must never appear in public resource
    expect($resourceData)->not->toHaveKey('address_line_1');
    expect($resourceData)->not->toHaveKey('address');
    // postal_code and full address are also excluded
    expect($resourceData)->not->toHaveKey('postal_code');

    // Public-safe locality fields must be present
    expect($resourceData)->toHaveKey('city');
    expect($resourceData)->toHaveKey('state_or_region');
});

test('public leader endpoint DOES include locality and administrative_area fields', function () {
    $leader = Leader::factory()->create([
        'city' => 'Portland',
        'state_or_region' => 'OR',
    ]);

    $resource = new PublicLeaderResource($leader);
    $request = Request::create('/');
    $resourceData = $resource->toArray($request);

    expect($resourceData['city'])->toBe('Portland');
    expect($resourceData['state_or_region'])->toBe('OR');
});

test('organizer leader view includes full address object', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id' => $user->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $address = Address::create([
        'country_code' => 'US',
        'address_line_1' => '789 Elm St',
        'locality' => 'Austin',
        'administrative_area' => 'TX',
        'postal_code' => '78701',
    ]);

    $leader = Leader::factory()->create([
        'address_id' => $address->id,
    ]);

    $organization->leaders()->attach($leader->id, ['status' => 'active']);

    $response = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$organization->id}/leaders/{$leader->id}");

    $response->assertStatus(200);
    expect($response->json('address.address_line_1'))->toBe('789 Elm St');
});

// ══════════════════════════════════════════════════════════════
// Organization address integration
// ══════════════════════════════════════════════════════════════

test('organization can have structured address', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);

    $response = $this->actingAs($user, 'sanctum')
        ->patchJson("/api/v1/organizations/{$organization->id}", [
            'address' => [
                'country_code' => 'US',
                'address_line_1' => '100 Business Blvd',
                'locality' => 'Chicago',
                'administrative_area' => 'IL',
                'postal_code' => '60601',
            ],
        ]);

    $response->assertStatus(200);

    $organization->refresh();
    expect($organization->address_id)->not->toBeNull();

    $getResponse = $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/organizations/{$organization->id}");

    $getResponse->assertStatus(200);
    expect($getResponse->json('address'))->not->toBeNull();
});

// ══════════════════════════════════════════════════════════════
// Workshop logistics hotel address
// ══════════════════════════════════════════════════════════════

test('hotel address stored as structured address on logistics', function () {
    $user = User::factory()->create();
    $organization = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $organization->id,
        'user_id' => $user->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $workshop = Workshop::factory()->create(['organization_id' => $organization->id]);

    $response = $this->actingAs($user, 'sanctum')
        ->putJson("/api/v1/workshops/{$workshop->id}/logistics", [
            'hotel_name' => 'Grand Hotel',
            'hotel_address' => [
                'country_code' => 'US',
                'address_line_1' => '200 Hotel Way',
                'locality' => 'Denver',
                'administrative_area' => 'CO',
                'postal_code' => '80201',
            ],
        ]);

    $response->assertStatus(200);

    $logistics = WorkshopLogistics::where('workshop_id', $workshop->id)->first();
    expect($logistics->hotel_address_id)->not->toBeNull();
});

// ══════════════════════════════════════════════════════════════
// Data migration command
// ══════════════════════════════════════════════════════════════

test('addresses:migrate command migrates existing location address data', function () {
    $organization = Organization::factory()->create();

    $location = Location::create([
        'organization_id' => $organization->id,
        'name' => 'Old Venue',
        'address_line_1' => '999 Old St',
        'address_line_2' => null,
        'city' => 'Phoenix',
        'state_or_region' => 'AZ',
        'postal_code' => '85001',
        'country' => 'US',
        'address_id' => null,
    ]);

    $beforeCount = Address::count();

    $this->artisan('addresses:migrate')
        ->assertExitCode(0);

    $location->refresh();
    expect($location->address_id)->not->toBeNull();
    expect(Address::count())->toBeGreaterThan($beforeCount);

    $address = Address::find($location->address_id);
    expect($address->address_line_1)->toBe('999 Old St');
    expect($address->locality)->toBe('Phoenix');
    expect($address->administrative_area)->toBe('AZ');
    expect($address->postal_code)->toBe('85001');
});

test('addresses:migrate --dry-run shows plan without changing data', function () {
    $organization = Organization::factory()->create();

    Location::create([
        'organization_id' => $organization->id,
        'name' => 'Dry Run Venue',
        'address_line_1' => '100 Dry Run St',
        'city' => 'Las Vegas',
        'state_or_region' => 'NV',
        'postal_code' => '89101',
        'country' => 'US',
        'address_id' => null,
    ]);

    $beforeCount = Address::count();

    $this->artisan('addresses:migrate --dry-run')
        ->expectsOutputToContain('Dry run complete')
        ->assertExitCode(0);

    // Dry run must not create any address rows
    expect(Address::count())->toBe($beforeCount);
});

test('after migration addresses count matches migrated location count', function () {
    $organization = Organization::factory()->create();

    // Create 3 locations with flat address fields, none yet linked
    foreach (['111 Alpha St', '222 Beta Ave', '333 Gamma Blvd'] as $street) {
        Location::create([
            'organization_id' => $organization->id,
            'name' => $street,
            'address_line_1' => $street,
            'city' => 'Miami',
            'state_or_region' => 'FL',
            'postal_code' => '33101',
            'country' => 'US',
            'address_id' => null,
        ]);
    }

    $beforeCount = Address::count();

    $this->artisan('addresses:migrate')->assertExitCode(0);

    expect(Address::count())->toBe($beforeCount + 3);
});

// ══════════════════════════════════════════════════════════════
// Cross-tenant security
// ══════════════════════════════════════════════════════════════

test('cross tenant cannot update another orgs location address', function () {
    $userA = User::factory()->create();
    $organizationA = Organization::factory()->create();
    $organizationB = Organization::factory()->create();

    OrganizationUser::factory()->create([
        'organization_id' => $organizationA->id,
        'user_id' => $userA->id,
        'role' => 'admin',
        'is_active' => true,
    ]);

    $locationB = Location::factory()->create(['organization_id' => $organizationB->id]);

    $this->actingAs($userA, 'sanctum')
        ->patchJson("/api/v1/locations/{$locationB->id}", [
            'address' => [
                'country_code' => 'US',
                'address_line_1' => 'Injected Address',
            ],
        ])
        ->assertStatus(403);
});
