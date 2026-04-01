<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\UpdateNotificationPreferencesRequest;
use App\Http\Resources\NotificationPreferenceResource;
use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    /**
     * GET /api/v1/me/notification-preferences
     *
     * Return the authenticated user's notification preferences.
     * If no row exists, return the default values without persisting.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        $prefs = NotificationPreference::firstOrNew(
            ['user_id' => $user->id],
            [
                'email_enabled'            => true,
                'push_enabled'             => true,
                'workshop_updates_enabled' => true,
                'reminder_enabled'         => true,
                'marketing_enabled'        => false,
            ]
        );

        return response()->json(new NotificationPreferenceResource($prefs));
    }

    /**
     * PUT /api/v1/me/notification-preferences
     *
     * Update the authenticated user's notification preferences.
     *
     * NOTE: These preferences apply to workshop/marketing notifications only.
     * Critical transactional emails (email verification, password reset,
     * leader invitation) cannot be suppressed by preferences.
     */
    public function update(UpdateNotificationPreferencesRequest $request): JsonResponse
    {
        $user = $request->user();

        $prefs = NotificationPreference::updateOrCreate(
            ['user_id' => $user->id],
            $request->validated()
        );

        return response()->json(new NotificationPreferenceResource($prefs));
    }
}
