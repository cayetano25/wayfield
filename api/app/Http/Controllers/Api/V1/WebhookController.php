<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\WebhookDelivery;
use App\Models\WebhookEndpoint;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Manages webhook endpoints for an organization.
 *
 * All routes require owner or admin role on the organization.
 */
class WebhookController extends Controller
{
    /**
     * GET /api/v1/organizations/{organization}/webhooks
     *
     * Lists all webhook endpoints for the organization.
     * The secret_encrypted field is never returned.
     */
    public function index(Organization $organization): JsonResponse
    {
        $this->authorizeOrgAccess($organization);

        $endpoints = WebhookEndpoint::where('organization_id', $organization->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (WebhookEndpoint $e) => $this->serialize($e));

        return response()->json(['data' => $endpoints]);
    }

    /**
     * POST /api/v1/organizations/{organization}/webhooks
     *
     * Registers a new webhook endpoint.
     * The raw secret is returned once in the response and never again.
     */
    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOrgAccess($organization);

        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:1000',
                function ($attribute, $value, $fail) {
                    if (app()->isProduction() && ! str_starts_with($value, 'https://')) {
                        $fail('Webhook URL must use HTTPS in production.');
                    }
                },
            ],
            'secret' => ['required', 'string', 'min:16', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            'event_types' => ['required', 'array', 'min:1'],
            'event_types.*' => ['required', 'string'],
        ]);

        $endpoint = WebhookEndpoint::create([
            'organization_id' => $organization->id,
            'url' => $validated['url'],
            'secret_encrypted' => encrypt($validated['secret']),
            'description' => $validated['description'] ?? null,
            'is_active' => true,
            'event_types' => $validated['event_types'],
        ]);

        return response()->json([
            'data' => $this->serialize($endpoint),
            'signing_instructions' => 'To verify webhook authenticity, compute '
                .'hash_hmac("sha256", $rawPayload, $secret) and compare with the '
                .'X-Wayfield-Signature header using hash_equals().',
        ], 201);
    }

    /**
     * DELETE /api/v1/organizations/{organization}/webhooks/{endpoint}
     *
     * Deactivates a webhook endpoint (soft delete via is_active = false).
     */
    public function destroy(Organization $organization, WebhookEndpoint $endpoint): JsonResponse
    {
        $this->authorizeOrgAccess($organization);

        if ($endpoint->organization_id !== $organization->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $endpoint->update(['is_active' => false]);

        return response()->json(['message' => 'Webhook endpoint deactivated.']);
    }

    /**
     * GET /api/v1/organizations/{organization}/webhooks/{endpoint}/deliveries
     *
     * Returns the last 50 delivery records for this endpoint.
     */
    public function deliveries(Organization $organization, WebhookEndpoint $endpoint): JsonResponse
    {
        $this->authorizeOrgAccess($organization);

        if ($endpoint->organization_id !== $organization->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $deliveries = WebhookDelivery::where('webhook_endpoint_id', $endpoint->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn (WebhookDelivery $d) => [
                'id' => $d->id,
                'event_type' => $d->event_type,
                'response_status' => $d->response_status,
                'attempt_count' => $d->attempt_count,
                'delivered_at' => $d->delivered_at?->toIso8601String(),
                'next_retry_at' => $d->next_retry_at?->toIso8601String(),
                'created_at' => $d->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $deliveries]);
    }

    private function serialize(WebhookEndpoint $endpoint): array
    {
        return [
            'id' => $endpoint->id,
            'url' => $endpoint->url,
            'description' => $endpoint->description,
            'is_active' => $endpoint->is_active,
            'event_types' => $endpoint->event_types,
            'failure_count' => $endpoint->failure_count,
            'last_success_at' => $endpoint->last_success_at?->toIso8601String(),
            'last_failure_at' => $endpoint->last_failure_at?->toIso8601String(),
            'created_at' => $endpoint->created_at?->toIso8601String(),
        ];
    }

    private function authorizeOrgAccess(Organization $organization): void
    {
        // Allowed: owner, admin
        if (! $organization->isElevatedMember(Auth::user())) {
            abort(403, 'Requires owner or admin role.');
        }
    }
}
