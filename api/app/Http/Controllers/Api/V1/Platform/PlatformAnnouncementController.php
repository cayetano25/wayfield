<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Platform\Services\PlatformAuditService;
use App\Http\Controllers\Api\V1\SystemAnnouncementController;
use App\Http\Controllers\Controller;
use App\Models\AdminUser;
use App\Models\PlatformConfig;
use App\Models\SystemAnnouncement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PlatformAnnouncementController extends Controller
{
    public function __construct(
        private readonly PlatformAuditService $audit,
    ) {}

    /**
     * GET /api/v1/platform/system-announcements
     *
     * Returns all system announcements paginated.
     * Accessible by any active platform admin role.
     *
     * Filters: is_active (boolean), type (announcement_type string)
     */
    public function index(Request $request): JsonResponse
    {
        $announcements = SystemAnnouncement::query()
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', filter_var($request->input('is_active'), FILTER_VALIDATE_BOOLEAN))
            )
            ->when($request->input('type'), fn ($q, $type) => $q->where('announcement_type', $type)
            )
            ->orderBy('created_at', 'desc')
            ->paginate(25);

        return response()->json($announcements);
    }

    /**
     * POST /api/v1/platform/system-announcements
     *
     * Creates a new system announcement.
     * Requires super_admin or admin platform role.
     */
    public function store(Request $request): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser->hasRole('super_admin', 'admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string'],
            'announcement_type' => ['required', 'string', Rule::in(['info', 'warning', 'maintenance', 'outage', 'update'])],
            'severity' => ['sometimes', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'target_audience' => ['sometimes', 'string', Rule::in(['all', 'organizers'])],
            'is_dismissable' => ['sometimes', 'boolean'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        $announcement = SystemAnnouncement::create([
            ...$validated,
            'created_by_admin_id' => $adminUser->id,
        ]);

        $this->audit->record(
            action: 'system_announcement_created',
            adminUser: $adminUser,
            options: [
                'entity_type' => 'system_announcement',
                'entity_id' => $announcement->id,
                'ip_address' => $request->ip(),
                'metadata_json' => [
                    'title' => $announcement->title,
                    'type' => $announcement->announcement_type,
                    'severity' => $announcement->severity,
                    'starts_at' => $announcement->starts_at?->toIso8601String(),
                ],
            ]
        );

        return response()->json($announcement, 201);
    }

    /**
     * PATCH /api/v1/platform/system-announcements/{announcement}
     *
     * Updates an existing system announcement.
     * Requires super_admin or admin platform role.
     */
    public function update(Request $request, SystemAnnouncement $announcement): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser->hasRole('super_admin', 'admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'message' => ['sometimes', 'string'],
            'announcement_type' => ['sometimes', 'string', Rule::in(['info', 'warning', 'maintenance', 'outage', 'update'])],
            'severity' => ['sometimes', 'string', Rule::in(['low', 'medium', 'high', 'critical'])],
            'target_audience' => ['sometimes', 'string', Rule::in(['all', 'organizers'])],
            'is_active' => ['sometimes', 'boolean'],
            'is_dismissable' => ['sometimes', 'boolean'],
            'starts_at' => ['sometimes', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        $announcement->update($validated);

        $this->audit->record(
            action: 'system_announcement_updated',
            adminUser: $adminUser,
            options: [
                'entity_type' => 'system_announcement',
                'entity_id' => $announcement->id,
                'ip_address' => $request->ip(),
                'metadata_json' => $validated,
            ]
        );

        return response()->json($announcement->fresh());
    }

    /**
     * DELETE /api/v1/platform/system-announcements/{announcement}
     *
     * Hard deletes the announcement.
     * Requires super_admin role only.
     */
    public function destroy(Request $request, SystemAnnouncement $announcement): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser->hasRole('super_admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $this->audit->record(
            action: 'system_announcement_deleted',
            adminUser: $adminUser,
            options: [
                'entity_type' => 'system_announcement',
                'entity_id' => $announcement->id,
                'ip_address' => $request->ip(),
                'metadata_json' => ['title' => $announcement->title],
            ]
        );

        $announcement->delete();

        return response()->json(null, 204);
    }

    /**
     * POST /api/platform/v1/system-announcements/{announcement}/deactivate
     *
     * Immediately hides the announcement without deleting it.
     * Useful for emergency shutdown of an active announcement.
     */
    public function deactivate(Request $request, SystemAnnouncement $announcement): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser->hasRole('super_admin', 'admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $announcement->update(['is_active' => false]);

        $this->audit->record(
            action: 'system_announcement_deactivated',
            adminUser: $adminUser,
            options: [
                'entity_type' => 'system_announcement',
                'entity_id'   => $announcement->id,
                'ip_address'  => $request->ip(),
                'metadata_json' => ['title' => $announcement->title],
            ]
        );

        SystemAnnouncementController::invalidateCache();

        return response()->json($announcement->fresh());
    }

    /**
     * GET /api/platform/v1/maintenance
     *
     * Returns the current maintenance mode state from platform_config.
     */
    public function maintenanceStatus(): JsonResponse
    {
        return response()->json([
            'maintenance_mode'    => PlatformConfig::get('maintenance_mode', false),
            'maintenance_message' => PlatformConfig::get('maintenance_message'),
            'maintenance_ends_at' => DB::table('platform_config')
                ->where('config_key', 'maintenance_ends_at')
                ->value('config_value'),
        ]);
    }

    /**
     * POST /api/platform/v1/maintenance/enable
     *
     * Enables maintenance mode. All tenant API routes return 503.
     * Restricted to super_admin only.
     */
    public function enableMaintenance(Request $request): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser->hasRole('super_admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:1000'],
            'ends_at' => ['nullable', 'date'],
        ]);

        $this->setPlatformConfig('maintenance_mode', 'true', $adminUser->id);
        $this->setPlatformConfig('maintenance_message', $validated['message'], $adminUser->id);
        $this->setPlatformConfig('maintenance_ends_at', $validated['ends_at'] ?? null, $adminUser->id);

        Cache::forget('maintenance_mode_active');
        Cache::forget('maintenance_message');
        SystemAnnouncementController::invalidateCache();

        $this->audit->record(
            action: 'maintenance_mode.enabled',
            adminUser: $adminUser,
            options: [
                'ip_address'    => $request->ip(),
                'metadata_json' => [
                    'message' => $validated['message'],
                    'ends_at' => $validated['ends_at'] ?? null,
                ],
            ]
        );

        return response()->json([
            'maintenance_mode' => true,
            'message'          => $validated['message'],
            'ends_at'          => $validated['ends_at'] ?? null,
        ]);
    }

    /**
     * POST /api/platform/v1/maintenance/disable
     *
     * Disables maintenance mode. Restricted to super_admin only.
     */
    public function disableMaintenance(Request $request): JsonResponse
    {
        /** @var AdminUser $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser->hasRole('super_admin')) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        $this->setPlatformConfig('maintenance_mode', 'false', $adminUser->id);
        $this->setPlatformConfig('maintenance_ends_at', null, $adminUser->id);

        Cache::forget('maintenance_mode_active');
        Cache::forget('maintenance_message');
        SystemAnnouncementController::invalidateCache();

        $this->audit->record(
            action: 'maintenance_mode.disabled',
            adminUser: $adminUser,
            options: ['ip_address' => $request->ip()]
        );

        return response()->json(['maintenance_mode' => false]);
    }

    private function setPlatformConfig(string $key, ?string $value, int $adminId): void
    {
        DB::table('platform_config')
            ->where('config_key', $key)
            ->update([
                'config_value'        => $value ?? '',
                'updated_by_admin_id' => $adminId,
                'updated_at'          => now(),
            ]);
    }
}
