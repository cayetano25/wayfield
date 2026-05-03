<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AnnouncementDismissal;
use App\Models\PlatformConfig;
use App\Models\SystemAnnouncement;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SystemAnnouncementController extends Controller
{
    private const CACHE_KEY = 'system.announcements.active';
    private const CACHE_TTL = 60;

    /**
     * GET /api/v1/system/announcements
     *
     * Public endpoint — auth is optional. When a valid Sanctum token is present
     * (via AttemptSanctumAuth / auth.optional middleware), is_dismissed is
     * resolved per user. Unauthenticated requests always get is_dismissed = false.
     *
     * Response includes maintenance mode state from platform_config.
     */
    public function index(Request $request): JsonResponse
    {
        $cached = Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            $announcements = SystemAnnouncement::currentlyActive()->get();

            return [
                'maintenance_mode'    => PlatformConfig::get('maintenance_mode', false),
                'maintenance_message' => PlatformConfig::get('maintenance_message'),
                'maintenance_ends_at' => DB::table('platform_config')
                    ->where('config_key', 'maintenance_ends_at')
                    ->value('config_value'),
                'announcement_ids'    => $announcements->pluck('id')->all(),
                'announcements'       => $announcements->map(fn (SystemAnnouncement $a) => [
                    'id'                => $a->id,
                    'title'             => $a->title,
                    'message'           => $a->message,
                    'announcement_type' => $a->announcement_type,
                    'severity'          => $a->severity,
                    'is_dismissable'    => $a->severity === 'critical' ? false : $a->is_dismissable,
                    'ends_at'           => $a->ends_at?->toIso8601String(),
                    'created_at'        => $a->created_at->toIso8601String(),
                    'color'             => SystemAnnouncement::TYPE_COLORS[$a->announcement_type] ?? null,
                ])->values()->all(),
            ];
        });

        $user = auth('sanctum')->user();

        $dismissedIds = [];
        if ($user && ! empty($cached['announcement_ids'])) {
            $dismissedIds = AnnouncementDismissal::where('user_id', $user->id)
                ->whereIn('announcement_id', $cached['announcement_ids'])
                ->pluck('announcement_id')
                ->all();
        }

        $announcements = array_map(function (array $a) use ($dismissedIds) {
            $a['is_dismissed'] = in_array($a['id'], $dismissedIds, true);

            return $a;
        }, $cached['announcements']);

        return response()->json([
            'maintenance_mode'    => $cached['maintenance_mode'],
            'maintenance_message' => $cached['maintenance_message'],
            'maintenance_ends_at' => $cached['maintenance_ends_at'],
            'announcements'       => $announcements,
        ]);
    }

    /**
     * POST /api/v1/system/announcements/{id}/dismiss
     *
     * Records that the authenticated user has dismissed this announcement.
     * Critical severity announcements cannot be dismissed.
     * Idempotent — dismissing the same announcement twice is a no-op.
     */
    public function dismiss(Request $request, int $id): JsonResponse
    {
        $announcement = SystemAnnouncement::find($id);

        if (! $announcement) {
            return response()->json(['message' => 'Announcement not found.'], 404);
        }

        if ($announcement->severity === 'critical') {
            return response()->json(['error' => 'critical_not_dismissable'], 422);
        }

        AnnouncementDismissal::upsert(
            [
                'announcement_id' => $id,
                'user_id'         => $request->user()->id,
                'dismissed_at'    => now(),
            ],
            ['announcement_id', 'user_id'],
            ['dismissed_at'],
        );

        Cache::forget(self::CACHE_KEY);

        return response()->json(['dismissed' => true]);
    }

    public static function invalidateCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
