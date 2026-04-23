<?php

namespace App\Domain\Leaders\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\Leader;
use App\Models\Organization;
use App\Models\OrganizationLeader;
use App\Models\User;
use App\Models\Workshop;
use App\Models\WorkshopLeader;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Arr;

class SelfEnrollAsLeaderAction
{
    public function enroll(
        User $user,
        Organization $organization,
        ?Workshop $workshop,
        array $profileData = []
    ): Leader {
        // Domain safeguard — policy handles HTTP layer; this is a belt-and-suspenders check.
        $isOwnerOrAdmin = $user->organizationUsers()
            ->where('organization_id', $organization->id)
            ->where('is_active', true)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();

        if (! $isOwnerOrAdmin) {
            throw new AuthorizationException('Only organization owners and admins may self-enroll as leaders.');
        }

        $leader = Leader::firstOrCreate(
            ['user_id' => $user->id],
            [
                'first_name' => $user->first_name,
                'last_name'  => $user->last_name,
                'email'      => $user->email,
            ]
        );

        $allowedProfileFields = [
            'bio', 'website_url', 'phone_number', 'city', 'state_or_region',
            'postal_code', 'country', 'display_name', 'profile_image_url',
        ];

        if (! empty($profileData)) {
            $updates = Arr::only($profileData, $allowedProfileFields);
            if (! empty($updates)) {
                $leader->update($updates);
            }
        }

        OrganizationLeader::updateOrCreate(
            ['organization_id' => $organization->id, 'leader_id' => $leader->id],
            ['status' => 'active']
        );

        if ($workshop !== null) {
            WorkshopLeader::updateOrCreate(
                ['workshop_id' => $workshop->id, 'leader_id' => $leader->id],
                ['is_confirmed' => true, 'invitation_id' => null]
            );
        }

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id'   => $user->id,
            'entity_type'     => 'leader',
            'entity_id'       => $leader->id,
            'action'          => 'owner_self_enrolled_as_leader',
            'metadata'        => [
                'workshop_id'          => $workshop?->id,
                'leader_id'            => $leader->id,
                'was_existing_profile' => ! $leader->wasRecentlyCreated,
            ],
        ]);

        return $leader;
    }
}
