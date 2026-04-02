<?php

namespace App\Domain\Subscriptions\Services;

use App\Models\Organization;
use App\Models\Registration;
use App\Models\Workshop;

class BuildUsageReportService
{
    public function __construct(
        private readonly ResolveOrganizationEntitlementsService $entitlementsService,
    ) {}

    /**
     * Build a usage report for the organization showing current usage vs plan limits.
     *
     * @return array{
     *   plan: string,
     *   limits: array,
     *   usage: array{
     *     active_workshop_count: int,
     *     total_workshop_count: int,
     *     active_manager_count: int,
     *     active_leader_count: int,
     *     total_participant_count: int,
     *     participants_by_workshop: array,
     *   }
     * }
     */
    public function build(Organization $organization): array
    {
        $entitlements = $this->entitlementsService->resolve($organization);

        $workshops = Workshop::where('organization_id', $organization->id)->get();

        $totalWorkshops = $workshops->count();

        $participantsByWorkshop = $workshops->map(function (Workshop $workshop) use ($entitlements) {
            $count = Registration::where('workshop_id', $workshop->id)
                ->where('registration_status', 'registered')
                ->count();

            return [
                'workshop_id'    => $workshop->id,
                'workshop_title' => $workshop->title,
                'status'         => $workshop->status,
                'participant_count' => $count,
                'limit'          => $entitlements['limits']['max_participants_per_workshop'],
            ];
        })->values()->all();

        $totalParticipants = Registration::whereIn('workshop_id', $workshops->pluck('id'))
            ->where('registration_status', 'registered')
            ->distinct('user_id')
            ->count('user_id');

        return [
            'plan'   => $entitlements['plan'],
            'limits' => $entitlements['limits'],
            'usage'  => [
                'active_workshop_count'   => $entitlements['usage']['active_workshop_count'],
                'total_workshop_count'    => $totalWorkshops,
                'active_manager_count'    => $entitlements['usage']['active_manager_count'],
                'active_leader_count'     => $entitlements['usage']['active_leader_count'],
                'total_participant_count' => $totalParticipants,
                'participants_by_workshop' => $participantsByWorkshop,
            ],
        ];
    }
}
