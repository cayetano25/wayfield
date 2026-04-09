<?php

declare(strict_types=1);

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

// ─── memberRole() ─────────────────────────────────────────

test('memberRole returns owner for owner user', function () {
    [$org, $user] = orgWithRole('owner');

    expect($org->memberRole($user))->toBe('owner');
});

test('memberRole returns admin for admin user', function () {
    [$org, $user] = orgWithRole('admin');

    expect($org->memberRole($user))->toBe('admin');
});

test('memberRole returns null for user not in organization', function () {
    $org      = Organization::factory()->create();
    $outsider = User::factory()->create();

    expect($org->memberRole($outsider))->toBeNull();
});

test('memberRole returns null for inactive membership', function () {
    $org  = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => 'admin',
        'is_active'       => false, // inactive — must not grant access
    ]);

    expect($org->memberRole($user))->toBeNull();
});

test('memberRole returns billing_admin role correctly', function () {
    [$org, $user] = orgWithRole('billing_admin');

    expect($org->memberRole($user))->toBe('billing_admin');
});

// ─── isElevatedMember() ───────────────────────────────────

test('isElevatedMember returns true for owner', function () {
    [$org, $user] = orgWithRole('owner');
    expect($org->isElevatedMember($user))->toBeTrue();
});

test('isElevatedMember returns true for admin', function () {
    [$org, $user] = orgWithRole('admin');
    expect($org->isElevatedMember($user))->toBeTrue();
});

test('isElevatedMember returns false for staff', function () {
    [$org, $user] = orgWithRole('staff');
    expect($org->isElevatedMember($user))->toBeFalse();
});

test('isElevatedMember returns false for billing_admin', function () {
    [$org, $user] = orgWithRole('billing_admin');
    expect($org->isElevatedMember($user))->toBeFalse();
});

test('isElevatedMember returns false for non-member', function () {
    $org  = Organization::factory()->create();
    $user = User::factory()->create();
    expect($org->isElevatedMember($user))->toBeFalse();
});

// ─── isOperationalMember() ────────────────────────────────

test('isOperationalMember returns true for owner, admin, staff', function () {
    foreach (['owner', 'admin', 'staff'] as $role) {
        [$org, $user] = orgWithRole($role);
        expect($org->isOperationalMember($user))
            ->toBeTrue("Expected true for role: {$role}");
    }
});

test('isOperationalMember returns false for billing_admin', function () {
    [$org, $user] = orgWithRole('billing_admin');
    expect($org->isOperationalMember($user))->toBeFalse();
});

// ─── hasBillingAccess() ───────────────────────────────────

test('hasBillingAccess returns true for owner and billing_admin', function () {
    foreach (['owner', 'billing_admin'] as $role) {
        [$org, $user] = orgWithRole($role);
        expect($org->hasBillingAccess($user))
            ->toBeTrue("Expected true for role: {$role}");
    }
});

test('hasBillingAccess returns false for admin and staff', function () {
    foreach (['admin', 'staff'] as $role) {
        [$org, $user] = orgWithRole($role);
        expect($org->hasBillingAccess($user))
            ->toBeFalse("Expected false for role: {$role}");
    }
});

// ─── isSoleOwner() ────────────────────────────────────────

test('isSoleOwner returns true when the user is the only active owner', function () {
    [$org, $owner] = orgWithRole('owner');
    expect($org->isSoleOwner($owner))->toBeTrue();
});

test('isSoleOwner returns false when there are two active owners', function () {
    [$org, $owner1] = orgWithRole('owner');
    $owner2         = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $owner2->id,
        'role'            => 'owner',
        'is_active'       => true,
    ]);

    expect($org->isSoleOwner($owner1))->toBeFalse();
    expect($org->isSoleOwner($owner2))->toBeFalse();
});

test('isSoleOwner returns false for non-owner', function () {
    [$org, $user] = orgWithRole('admin');
    expect($org->isSoleOwner($user))->toBeFalse();
});

// ─── Helper ───────────────────────────────────────────────

function orgWithRole(string $role): array
{
    $org  = Organization::factory()->create();
    $user = User::factory()->create();
    OrganizationUser::create([
        'organization_id' => $org->id,
        'user_id'         => $user->id,
        'role'            => $role,
        'is_active'       => true,
    ]);

    return [$org, $user];
}
