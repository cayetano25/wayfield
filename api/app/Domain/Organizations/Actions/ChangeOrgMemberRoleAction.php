<?php

declare(strict_types=1);

namespace App\Domain\Organizations\Actions;

use App\Domain\Shared\Services\AuditLogService;
use App\Models\OrganizationUser;
use App\Models\User;

class ChangeOrgMemberRoleAction
{
    public function execute(OrganizationUser $member, string $newRole, User $actor): OrganizationUser
    {
        $oldRole = $member->role;

        $member->update(['role' => $newRole]);

        AuditLogService::record([
            'organization_id' => $member->organization_id,
            'actor_user_id' => $actor->id,
            'entity_type' => 'organization_user',
            'entity_id' => $member->id,
            'action' => 'org_member_role_changed',
            'metadata' => [
                'user_id' => $member->user_id,
                'old_role' => $oldRole,
                'new_role' => $newRole,
                'organization_id' => $member->organization_id,
            ],
        ]);

        return $member->fresh();
    }
}
