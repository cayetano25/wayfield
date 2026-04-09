<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Subscriptions\Actions\SetManualOverrideAction;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeatureFlagController extends Controller
{
    public function __construct(private readonly SetManualOverrideAction $action) {}

    /**
     * PUT /api/v1/organizations/{organization}/feature-flags
     * Set a manual override for a feature flag.
     *
     * Only users with role = 'owner' may call this.
     * Always produces an audit_logs record.
     */
    public function update(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        $data = $request->validate([
            'feature_key' => ['required', 'string', 'max:100'],
            'is_enabled' => ['required', 'boolean'],
        ]);

        try {
            $flag = $this->action->execute(
                organization: $organization,
                actor: $request->user(),
                featureKey: $data['feature_key'],
                isEnabled: $data['is_enabled'],
            );
        } catch (AuthorizationException $e) {
            return response()->json([
                'error' => 'forbidden',
                'message' => $e->getMessage(),
            ], 403);
        }

        return response()->json([
            'feature_key' => $flag->feature_key,
            'is_enabled' => $flag->is_enabled,
            'source' => $flag->source,
        ]);
    }
}
