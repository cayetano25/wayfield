<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Models\PlatformConfig;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformConfigController extends Controller
{
    public function __construct(
        private readonly PlatformAuditService $audit,
    ) {}

    public function index(): JsonResponse
    {
        $config = PlatformConfig::orderBy('config_key')->get(['config_key', 'config_value', 'description', 'updated_at']);

        return response()->json($config);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        /** @var AdminUser $admin */
        $admin = $request->user('platform_admin');

        if (! $admin->hasRole('super_admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $record = PlatformConfig::where('config_key', $key)->firstOrFail();

        $request->validate([
            'value' => ['present', 'nullable', 'string'],
        ]);

        $old = $record->config_value;
        $new = $request->input('value') ?? '';

        $record->update([
            'config_value'         => $new,
            'updated_by_admin_id'  => $admin->id,
        ]);

        $this->audit->record(
            action: 'platform_config.updated',
            adminUser: $admin,
            options: [
                'entity_type'   => 'platform_config',
                'ip_address'    => $request->ip(),
                'metadata_json' => [
                    'config_key' => $key,
                    'old'        => $old,
                    'new'        => $new,
                ],
            ]
        );

        return response()->json($record->fresh()->only(['config_key', 'config_value', 'description', 'updated_at']));
    }
}
