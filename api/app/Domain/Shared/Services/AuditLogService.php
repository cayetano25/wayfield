<?php

namespace App\Domain\Shared\Services;

use App\Models\AuditLog;

class AuditLogService
{
    /**
     * Record an auditable action.
     *
     * @param array{
     *   organization_id?: int|null,
     *   actor_user_id?: int|null,
     *   entity_type: string,
     *   entity_id?: int|null,
     *   action: string,
     *   metadata?: array<string, mixed>|null,
     * } $data
     */
    public static function record(array $data): AuditLog
    {
        return AuditLog::create([
            'organization_id' => $data['organization_id'] ?? null,
            'actor_user_id'   => $data['actor_user_id'] ?? null,
            'entity_type'     => $data['entity_type'],
            'entity_id'       => $data['entity_id'] ?? null,
            'action'          => $data['action'],
            'metadata_json'   => $data['metadata'] ?? null,
        ]);
    }
}
