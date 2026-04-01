<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\RegisterPushTokenRequest;
use App\Http\Resources\PushTokenResource;
use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushTokenController extends Controller
{
    /**
     * POST /api/v1/me/push-tokens
     *
     * Register or update a push token for the authenticated user.
     *
     * If the token already exists (for any user), it is re-assigned to the current
     * user and marked active. This handles device handover (e.g. new owner of a device).
     *
     * One token may be replaced on re-register — the UNIQUE(push_token) constraint
     * ensures no duplicate tokens across users.
     */
    public function store(RegisterPushTokenRequest $request): JsonResponse
    {
        $user = $request->user();

        $token = PushToken::updateOrCreate(
            ['push_token' => $request->input('push_token')],
            [
                'user_id'            => $user->id,
                'platform'           => $request->input('platform'),
                'is_active'          => true,
                'last_registered_at' => now(),
            ]
        );

        return response()->json(new PushTokenResource($token), $token->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * DELETE /api/v1/me/push-tokens/{pushToken}
     *
     * Deactivate a push token (e.g. on logout or explicit opt-out).
     * Only the token owner may deactivate it.
     */
    public function destroy(Request $request, PushToken $pushToken): JsonResponse
    {
        if ($pushToken->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $pushToken->update(['is_active' => false]);

        return response()->json(['message' => 'Push token deactivated.']);
    }
}
