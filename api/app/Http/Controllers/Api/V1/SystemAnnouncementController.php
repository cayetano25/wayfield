<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemAnnouncement;
use Illuminate\Http\JsonResponse;

class SystemAnnouncementController extends Controller
{
    /**
     * GET /api/v1/system/announcements
     *
     * Returns currently active, platform-wide announcements for any
     * authenticated user. No tenant scoping — announcements are global.
     *
     * Intentionally kept as a single simple query; this is called on every
     * dashboard load so it must stay fast.
     */
    public function index(): JsonResponse
    {
        $announcements = SystemAnnouncement::currentlyActive()
            ->get()
            ->map(fn (SystemAnnouncement $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'message' => $a->message,
                'announcement_type' => $a->announcement_type,
                'severity' => $a->severity,
                'is_dismissable' => $a->is_dismissable,
                'starts_at' => $a->starts_at?->toIso8601String(),
                'ends_at' => $a->ends_at?->toIso8601String(),
                'color' => SystemAnnouncement::TYPE_COLORS[$a->announcement_type] ?? null,
            ]);

        return response()->json(['data' => $announcements]);
    }
}
