<?php

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLogistics;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function logisticsOwner(): array
{
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'owner',
        'is_active' => true,
    ]);
    $workshop = Workshop::factory()->forOrganization($org->id)->create();

    return [$user, $org, $workshop];
}

test('owner can create logistics for a workshop', function () {
    [$user, $org, $workshop] = logisticsOwner();

    $this->actingAs($user, 'sanctum')
        ->putJson("/api/v1/workshops/{$workshop->id}/logistics", [
            'hotel_name' => 'Mountain Inn',
            'hotel_address' => '123 Summit Rd',
            'hotel_phone' => '555-1234',
            'hotel_notes' => 'Check-in is at 3pm',
            'parking_details' => 'Free parking in lot A',
            'meeting_room_details' => 'Ballroom C',
            'meetup_instructions' => 'Gather at the lobby',
        ])
        ->assertStatus(200)
        ->assertJsonPath('hotel_name', 'Mountain Inn')
        ->assertJsonPath('parking_details', 'Free parking in lot A');

    $this->assertDatabaseHas('workshop_logistics', [
        'workshop_id' => $workshop->id,
        'hotel_name' => 'Mountain Inn',
    ]);
});

test('putting logistics twice upserts (one row per workshop)', function () {
    [$user, $org, $workshop] = logisticsOwner();

    $this->actingAs($user, 'sanctum')
        ->putJson("/api/v1/workshops/{$workshop->id}/logistics", ['hotel_name' => 'First Hotel']);

    $this->actingAs($user, 'sanctum')
        ->putJson("/api/v1/workshops/{$workshop->id}/logistics", ['hotel_name' => 'Second Hotel'])
        ->assertStatus(200)
        ->assertJsonPath('hotel_name', 'Second Hotel');

    expect(WorkshopLogistics::where('workshop_id', $workshop->id)->count())->toBe(1);
});

test('owner can retrieve logistics', function () {
    [$user, $org, $workshop] = logisticsOwner();

    WorkshopLogistics::factory()->create([
        'workshop_id' => $workshop->id,
        'hotel_name' => 'Visible Hotel',
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/logistics")
        ->assertStatus(200)
        ->assertJsonPath('hotel_name', 'Visible Hotel');
});

test('logistics endpoint returns 404 when no logistics exist', function () {
    [$user, $org, $workshop] = logisticsOwner();

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/v1/workshops/{$workshop->id}/logistics")
        ->assertStatus(404);
});

test('staff cannot update logistics', function () {
    $user = User::factory()->create();
    $org = Organization::factory()->create();
    OrganizationUser::factory()->create([
        'organization_id' => $org->id,
        'user_id' => $user->id,
        'role' => 'staff',
        'is_active' => true,
    ]);
    $workshop = Workshop::factory()->forOrganization($org->id)->create();

    $this->actingAs($user, 'sanctum')
        ->putJson("/api/v1/workshops/{$workshop->id}/logistics", ['hotel_name' => 'Staff Hotel'])
        ->assertStatus(403);
});
