<?php

namespace App\Domain\Workshops\Actions;

use App\Domain\Workshops\Services\GenerateJoinCodeService;
use App\Models\Organization;
use App\Models\Workshop;

class CreateWorkshopAction
{
    public function __construct(private readonly GenerateJoinCodeService $joinCodeService) {}

    public function execute(Organization $organization, array $data): Workshop
    {
        return Workshop::create([
            'organization_id'     => $organization->id,
            'workshop_type'       => $data['workshop_type'],
            'title'               => $data['title'],
            'description'         => $data['description'],
            'status'              => 'draft',
            'timezone'            => $data['timezone'],
            'start_date'          => $data['start_date'],
            'end_date'            => $data['end_date'],
            'join_code'           => $this->joinCodeService->generate(),
            'default_location_id' => $data['default_location_id'] ?? null,
            'public_page_enabled' => $data['public_page_enabled'] ?? false,
            'public_slug'         => $data['public_slug'] ?? null,
        ]);
    }
}
