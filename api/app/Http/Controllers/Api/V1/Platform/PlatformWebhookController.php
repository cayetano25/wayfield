<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\WebhookEndpoint;
use Illuminate\Http\JsonResponse;

/**
 * Platform Admin — Webhook visibility.
 *
 * Allows platform admins to inspect webhook endpoints across all organizations.
 * The secret_encrypted field is never exposed.
 */
class PlatformWebhookController extends Controller
{
    /**
     * GET /api/v1/platform/organizations/{organization}/webhooks
     *
     * Shows all webhook endpoints for an organization including failure counts.
     */
    public function index(Organization $organization): JsonResponse
    {
        $endpoints = WebhookEndpoint::where('organization_id', $organization->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (WebhookEndpoint $e) => [
                'id'              => $e->id,
                'url'             => $e->url,
                'description'     => $e->description,
                'is_active'       => $e->is_active,
                'event_types'     => $e->event_types,
                'failure_count'   => $e->failure_count,
                'last_success_at' => $e->last_success_at?->toIso8601String(),
                'last_failure_at' => $e->last_failure_at?->toIso8601String(),
                'created_at'      => $e->created_at?->toIso8601String(),
                // secret_encrypted intentionally absent
            ]);

        return response()->json(['data' => $endpoints]);
    }
}
