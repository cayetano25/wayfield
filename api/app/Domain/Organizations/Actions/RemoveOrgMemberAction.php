<?php

declare(strict_types=1);

namespace App\Domain\Organizations\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\OrganizationUser;
use App\Models\User;

class RemoveOrgMemberAction
{
    public function execute(OrganizationUser $member, User $actor): void
    {
        $member->update(['is_active' => false]);

        AuditLogService::record([
            'organization_id' => $member->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'organization_user',
            'entity_id' => $member->id,
            'action' => 'org_member_removed',
            'metadata' => [
                'removed_user_id' => $member->user_id,
                'role' => $member->role,
                'removed_by_user_id' => $actor->id,
                'organization_id' => $member->organization_id,
            ],
        ]);
    }
}
