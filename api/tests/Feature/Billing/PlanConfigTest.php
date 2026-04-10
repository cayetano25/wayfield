<?php

use App\Domain\Subscriptions\Services\EnforceFeatureGateService;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// ─── GET /api/v1/plans ────────────────────────────────────────────────────────

test('plans endpoint returns all four plans in order', function () {
    $response = $this->getJson('/api/v1/plans');

    $response->assertOk();
    $plans = $response->json('plans');

    expect($plans)->toHaveCount(4);
    expect(array_column($plans, 'code'))->toBe(['free', 'starter', 'pro', 'enterprise']);
});

test('plans endpoint returns correct display names', function () {
    $response = $this->getJson('/api/v1/plans');

    $response->assertOk();
    $plans = collect($response->json('plans'))->keyBy('code');

    expect($plans['free']['display_name'])->toBe('Foundation');
    expect($plans['starter']['display_name'])->toBe('Creator');
    expect($plans['pro']['display_name'])->toBe('Studio');
    expect($plans['enterprise']['display_name'])->toBe('Enterprise');
});

test('plans endpoint includes limits and features for each plan', function () {
    $response = $this->getJson('/api/v1/plans');

    $response->assertOk();
    $plans = collect($response->json('plans'))->keyBy('code');

    foreach (['free', 'starter', 'pro', 'enterprise'] as $code) {
        expect($plans[$code])->toHaveKey('limits');
        expect($plans[$code])->toHaveKey('features');
        expect($plans[$code])->toHaveKey('monthly_cents');
    }
});

test('plans endpoint does not require authentication', function () {
    $response = $this->getJson('/api/v1/plans');

    $response->assertOk();
});

// ─── custom_branding feature gate ─────────────────────────────────────────────

test('custom_branding is false for free plan', function () {
    $plans = collect($this->getJson('/api/v1/plans')->json('plans'))->keyBy('code');

    expect($plans['free']['features']['custom_branding'])->toBeFalse();
});

test('custom_branding is false for starter plan', function () {
    $plans = collect($this->getJson('/api/v1/plans')->json('plans'))->keyBy('code');

    expect($plans['starter']['features']['custom_branding'])->toBeFalse();
});

test('custom_branding is true for pro plan', function () {
    $plans = collect($this->getJson('/api/v1/plans')->json('plans'))->keyBy('code');

    expect($plans['pro']['features']['custom_branding'])->toBeTrue();
});

test('custom_branding is true for enterprise plan', function () {
    $plans = collect($this->getJson('/api/v1/plans')->json('plans'))->keyBy('code');

    expect($plans['enterprise']['features']['custom_branding'])->toBeTrue();
});

// ─── EnforceFeatureGateService — unit tests ───────────────────────────────────

test('EnforceFeatureGateService hasFeature reads from config not hardcoded values', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->pro()->active()->create();

    $service = app(EnforceFeatureGateService::class);

    // custom_branding is a config-only feature (not in old PLAN_FEATURES)
    expect($service->hasFeature($org, 'custom_branding'))->toBeTrue();

    $orgFree = Organization::factory()->create();
    Subscription::factory()->forOrganization($orgFree->id)->free()->active()->create();

    expect($service->hasFeature($orgFree, 'custom_branding'))->toBeFalse();
});

test('isWithinLimit returns true when limit is null (unlimited)', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->pro()->active()->create();

    $service = app(EnforceFeatureGateService::class);

    // Pro has null (unlimited) for active_workshops
    expect($service->isWithinLimit($org, 'active_workshops', 99999))->toBeTrue();
});

test('isWithinLimit returns false when at the limit', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->free()->active()->create();

    $service = app(EnforceFeatureGateService::class);

    // Free plan: active_workshops limit is 2
    expect($service->isWithinLimit($org, 'active_workshops', 2))->toBeFalse();
    expect($service->isWithinLimit($org, 'active_workshops', 1))->toBeTrue();
});

test('isUpgrade returns true when target plan is higher', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->free()->active()->create();

    $service = app(EnforceFeatureGateService::class);

    expect($service->isUpgrade($org, 'starter'))->toBeTrue();
    expect($service->isUpgrade($org, 'pro'))->toBeTrue();
    expect($service->isUpgrade($org, 'enterprise'))->toBeTrue();
});

test('isUpgrade returns false when target plan is same or lower', function () {
    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->starter()->active()->create();

    $service = app(EnforceFeatureGateService::class);

    expect($service->isUpgrade($org, 'free'))->toBeFalse();
    expect($service->isUpgrade($org, 'starter'))->toBeFalse();
    expect($service->isUpgrade($org, 'pro'))->toBeTrue();
});

test('getPlanDisplayName returns correct display name from config', function () {
    $service = app(EnforceFeatureGateService::class);

    $org = Organization::factory()->create();
    Subscription::factory()->forOrganization($org->id)->starter()->active()->create();

    expect($service->getPlanDisplayName($org))->toBe('Creator');
});

test('org with no subscription defaults to free plan limits', function () {
    $org = Organization::factory()->create();
    $service = app(EnforceFeatureGateService::class);

    expect($service->getLimit($org, 'active_workshops'))->toBe(2);
    expect($service->hasFeature($org, 'custom_branding'))->toBeFalse();
});
