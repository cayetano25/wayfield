<?php

use App\Domain\Payments\Models\Coupon;
use App\Domain\Payments\Models\PaymentFeatureFlag;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(function () {
    Cache::forget('payment_flag.platform.payments_enabled');
});

function bulkOrg(string $role = 'owner'): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();

    if ($role !== 'none') {
        OrganizationUser::factory()->create([
            'organization_id' => $org->id,
            'user_id'         => $user->id,
            'role'            => $role,
            'is_active'       => true,
        ]);
    }

    bulkEnablePayments($org);

    return [$org, $user];
}

function bulkEnablePayments(Organization $org): void
{
    PaymentFeatureFlag::firstOrCreate(
        ['scope' => 'platform', 'flag_key' => 'payments_enabled'],
        ['is_enabled' => true],
    );

    PaymentFeatureFlag::firstOrCreate(
        ['scope' => 'organization', 'organization_id' => $org->id, 'flag_key' => 'org_payments_enabled'],
        ['is_enabled' => true, 'enabled_at' => now()],
    );
}

function bulkPayload(array $overrides = []): array
{
    return array_merge([
        'count'         => 5,
        'label'         => 'Test Batch',
        'discount_type' => 'percentage',
        'discount_pct'  => 10.00,
    ], $overrides);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

it('generates 10 codes with prefix PARTNER, all starting with PARTNER-', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count'  => 10,
            'prefix' => 'PARTNER',
        ]));

    $response->assertCreated()
        ->assertJsonPath('data.generated', 10)
        ->assertJsonPath('data.failed', 0);

    $codes = $response->json('data.codes');
    expect($codes)->toHaveCount(10);

    foreach ($codes as $code) {
        expect($code)->toStartWith('PARTNER-');
    }
});

it('generates 1 code with no prefix — 6-character random string', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 1,
        ]));

    $response->assertCreated()
        ->assertJsonPath('data.generated', 1);

    $codes = $response->json('data.codes');
    expect($codes)->toHaveCount(1);
    expect(strlen($codes[0]))->toBe(6);
});

it('generates 500 codes — the maximum allowed', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 500,
        ]));

    $response->assertCreated()
        ->assertJsonPath('data.generated', 500);

    expect(Coupon::where('organization_id', $org->id)->count())->toBe(500);
});

it('returns 422 when count exceeds 500', function () {
    [$org, $user] = bulkOrg('owner');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 501,
        ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['count']);
});

it('returns 422 when label is missing', function () {
    [$org, $user] = bulkOrg('owner');

    $payload = bulkPayload();
    unset($payload['label']);

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['label']);
});

it('returns 403 for staff role', function () {
    [$org, $user] = bulkOrg('staff');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload())
        ->assertForbidden();
});

it('returns 403 for billing_admin role', function () {
    [$org, $user] = bulkOrg('billing_admin');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload())
        ->assertForbidden();
});

it('returns 403 for a user with no org membership', function () {
    [$org] = bulkOrg('owner');
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload())
        ->assertForbidden();
});

it('all generated codes are unique within the org', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 50,
        ]));

    $response->assertCreated();

    $codes = $response->json('data.codes');
    expect(count(array_unique($codes)))->toBe(count($codes));
});

it('all generated codes are uppercase', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count'  => 10,
            'prefix' => 'TEST',
        ]));

    $response->assertCreated();

    foreach ($response->json('data.codes') as $code) {
        expect($code)->toBe(strtoupper($code));
    }
});

it('all generated codes have max_redemptions = 1', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 5,
        ]));

    $response->assertCreated();

    $codes = $response->json('data.codes');

    $coupons = Coupon::where('organization_id', $org->id)
        ->whereIn('code', $codes)
        ->get();

    foreach ($coupons as $coupon) {
        expect($coupon->max_redemptions)->toBe(1);
    }
});

it('stores the label on all generated coupons', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 3,
            'label' => 'Photography Association Partnership — Nov 2026',
        ]));

    $response->assertCreated();

    $codes = $response->json('data.codes');

    Coupon::where('organization_id', $org->id)
        ->whereIn('code', $codes)
        ->each(function ($coupon) {
            expect($coupon->label)->toBe('Photography Association Partnership — Nov 2026');
        });
});

it('returns coupon_ids matching the created database records', function () {
    [$org, $user] = bulkOrg('owner');

    $response = $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 5,
        ]));

    $response->assertCreated();

    $couponIds = $response->json('data.coupon_ids');
    expect($couponIds)->toHaveCount(5);

    $dbIds = Coupon::where('organization_id', $org->id)->pluck('id')->toArray();
    foreach ($couponIds as $id) {
        expect($id)->toBeIn($dbIds);
    }
});

it('creates an audit log entry for bulk generation', function () {
    [$org, $user] = bulkOrg('owner');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count'  => 3,
            'prefix' => 'AUDIT',
            'label'  => 'Audit Test Batch',
        ]))
        ->assertCreated();

    $log = DB::table('audit_logs')
        ->where('organization_id', $org->id)
        ->where('actor_user_id', $user->id)
        ->where('action', 'coupon.bulk_generated')
        ->first();

    expect($log)->not->toBeNull();

    $metadata = json_decode($log->metadata_json, true);
    expect($metadata['count'])->toBe(3);
    expect($metadata['label'])->toBe('Audit Test Batch');
    expect($metadata['prefix'])->toBe('AUDIT');
});

it('GET /coupons/export returns a CSV with correct headers', function () {
    [$org, $user] = bulkOrg('owner');

    // Seed one coupon so the file is non-empty
    Coupon::create([
        'organization_id'    => $org->id,
        'created_by_user_id' => $user->id,
        'code'               => 'EXPTEST1',
        'label'              => 'Export Test',
        'discount_type'      => 'percentage',
        'discount_pct'       => 15.00,
        'is_active'          => true,
    ]);

    $response = $this->actingAs($user)
        ->get("/api/v1/organizations/{$org->id}/coupons/export");

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toContain('text/csv');

    $csv = $response->streamedContent();
    $lines = array_filter(explode("\n", $csv));
    $header = str_getcsv(array_values($lines)[0]);

    expect($header)->toBe(['Code', 'Label', 'Discount', 'Valid Until', 'Max Uses Per Person', 'Active']);
});

it('CSV export contains all codes matching the given label', function () {
    [$org, $user] = bulkOrg('owner');

    // Generate two batches with different labels
    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 4,
            'label' => 'Batch Alpha',
        ]))
        ->assertCreated();

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 3,
            'label' => 'Batch Beta',
        ]))
        ->assertCreated();

    $response = $this->actingAs($user)
        ->get("/api/v1/organizations/{$org->id}/coupons/export?label=Batch+Alpha");

    $response->assertOk();

    $csv   = $response->streamedContent();
    $lines = array_values(array_filter(explode("\n", $csv)));

    // First line is the header; data rows are the rest
    $dataLines = array_slice($lines, 1);
    expect(count($dataLines))->toBe(4);

    foreach ($dataLines as $line) {
        $row = str_getcsv($line);
        expect($row[1])->toBe('Batch Alpha'); // Label column
    }
});

it('export without label filter returns all org coupons', function () {
    [$org, $user] = bulkOrg('owner');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload(['count' => 3, 'label' => 'X']))
        ->assertCreated();

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload(['count' => 2, 'label' => 'Y']))
        ->assertCreated();

    $response = $this->actingAs($user)
        ->get("/api/v1/organizations/{$org->id}/coupons/export");

    $response->assertOk();
    $lines = array_values(array_filter(explode("\n", $response->streamedContent())));
    // 1 header + 5 data rows
    expect(count($lines))->toBe(6);
});

it('export returns 403 for staff role', function () {
    [$org, $user] = bulkOrg('staff');

    $this->actingAs($user)
        ->get("/api/v1/organizations/{$org->id}/coupons/export")
        ->assertForbidden();
});

it('admin role can bulk generate and export', function () {
    [$org, $user] = bulkOrg('admin');

    $this->actingAs($user)
        ->postJson("/api/v1/organizations/{$org->id}/coupons/bulk-generate", bulkPayload([
            'count' => 2,
        ]))
        ->assertCreated();

    $this->actingAs($user)
        ->get("/api/v1/organizations/{$org->id}/coupons/export")
        ->assertOk();
});
