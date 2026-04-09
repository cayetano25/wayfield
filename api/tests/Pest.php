<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Tests\TestCase;

uses(TestCase::class)->in('Feature');

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
