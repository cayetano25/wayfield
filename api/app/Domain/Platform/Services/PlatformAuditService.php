<?php

namespace App\Domain\Platform\Services;

use App\Models\AdminUser;
use App\Models\PlatformAuditLog;

class PlatformAuditService
{
    /**
     * Record a platform admin action in platform_audit_logs.
     *
     * Call this from platform controllers and services — never write
     * directly to platform_audit_logs from a controller.
     *
     * Example:
     *   app(PlatformAuditService::class)->record(
     *       action: 'plan_changed',
     *       adminUser: $request->user('platform_admin'),
     *       options: [
     *           'entity_type'     => 'organization',
     *           'entity_id'       => $org->id,
     *           'organization_id' => $org->id,
     *           'metadata_json'   => ['from' => 'starter', 'to' => 'pro'],
     *           'ip_address'      => $request->ip(),
     *       ]
     *   );
     *
     * @param string        $action    Short action identifier, e.g. 'plan_changed'
     * @param AdminUser|null $adminUser The authenticated platform admin (null for system-initiated)
     * @param array          $options  {
     *   @type string|null $entity_type
     *   @type int|null    $entity_id
     *   @type int|null    $organization_id
     *   @type array|null  $metadata_json
     *   @type string|null $ip_address
     * }
     */
    public function record(
        string $action,
        ?AdminUser $adminUser = null,
        array $options = [],
    ): PlatformAuditLog {
        return PlatformAuditLog::create([
            'admin_user_id'   => $adminUser?->id,
            'action'          => $action,
            'entity_type'     => $options['entity_type'] ?? null,
            'entity_id'       => $options['entity_id'] ?? null,
            'organization_id' => $options['organization_id'] ?? null,
            'metadata_json'   => $options['metadata_json'] ?? null,
            'ip_address'      => $options['ip_address'] ?? null,
        ]);
    }
}
