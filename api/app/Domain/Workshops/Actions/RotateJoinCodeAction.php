<?php

namespace App\Domain\Workshops\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Domain\Workshops\Services\GenerateJoinCodeService;
use App\Models\User;
use App\Models\Workshop;

class RotateJoinCodeAction
{
    public function __construct(private readonly GenerateJoinCodeService $joinCodeService) {}

    public function execute(Workshop $workshop, User $actor): string
    {
        $newCode = $this->joinCodeService->generate();

        $workshop->update([
            'join_code' => $newCode,
            'join_code_rotated_at' => now(),
            'join_code_rotated_by_user_id' => $actor->id,
        ]);

        // Do NOT include old or new join code values in audit metadata —
        // join codes are access credentials.
        AuditLogService::record([
            'organization_id' => $workshop->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'workshop',
            'entity_id' => $workshop->id,
            'action' => 'join_code_rotated',
            'metadata' => [
                'workshop_id' => $workshop->id,
                'workshop_title' => $workshop->title,
                'rotated_by_user_id' => $actor->id,
            ],
        ]);

        return $newCode;
    }
}
