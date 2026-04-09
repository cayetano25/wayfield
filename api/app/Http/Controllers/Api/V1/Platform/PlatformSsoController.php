<?php

namespace App\Http\Controllers\Api\V1\Platform;

use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\SsoConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Platform Admin — SSO configuration management.
 *
 * Accessible only to platform admins (guarded by platform.admin middleware).
 * GET: any platform admin role.
 * PUT (create/update): super_admin or admin only.
 */
class PlatformSsoController extends Controller
{
    /**
     * GET /api/v1/platform/organizations/{organization}/sso
     *
     * Returns the SSO configuration for an organization, or null if not set.
     * The client_secret_enc and certificate are omitted for security.
     */
    public function show(Organization $organization): JsonResponse
    {
        $config = SsoConfiguration::where('organization_id', $organization->id)->first();

        if (! $config) {
            return response()->json(['data' => null]);
        }

        return response()->json(['data' => $this->serialize($config)]);
    }

    /**
     * PUT /api/v1/platform/organizations/{organization}/sso
     *
     * Creates or updates the SSO configuration for an organization.
     * Writes a platform_audit_logs entry on every change.
     * Requires super_admin or admin platform role.
     */
    public function update(Request $request, Organization $organization): JsonResponse
    {
        $validated = $request->validate([
            'provider_type' => ['required', 'string', 'in:saml,oidc'],
            'is_enabled' => ['required', 'boolean'],
            'entity_id' => ['nullable', 'string', 'max:500'],
            'sso_url' => ['nullable', 'string', 'url', 'max:1000'],
            'certificate' => ['nullable', 'string'],
            'client_secret' => ['nullable', 'string', 'max:500'],
            'attribute_mapping' => ['nullable', 'array'],
            'allowed_domains' => ['nullable', 'array'],
            'allowed_domains.*' => ['string', 'max:255'],
        ]);

        $data = [
            'provider_type' => $validated['provider_type'],
            'is_enabled' => $validated['is_enabled'],
            'entity_id' => $validated['entity_id'] ?? null,
            'sso_url' => $validated['sso_url'] ?? null,
            'certificate' => $validated['certificate'] ?? null,
            'attribute_mapping' => $validated['attribute_mapping'] ?? null,
            'allowed_domains' => $validated['allowed_domains'] ?? null,
        ];

        // Encrypt the OIDC client secret if provided
        if (! empty($validated['client_secret'])) {
            $data['client_secret_enc'] = encrypt($validated['client_secret']);
        }

        $config = SsoConfiguration::updateOrCreate(
            ['organization_id' => $organization->id],
            $data,
        );

        // Audit the configuration change in platform audit logs.
        // Uses audit_logs table (platform context — organization_id may be null for platform-level events
        // but here we scope it to the org for traceability).
        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id' => Auth::id(),
            'entity_type' => 'sso_configuration',
            'entity_id' => $config->id,
            'action' => 'sso_configuration_updated',
            'metadata' => [
                'provider_type' => $validated['provider_type'],
                'is_enabled' => $validated['is_enabled'],
                'allowed_domains' => $validated['allowed_domains'] ?? [],
            ],
        ]);

        return response()->json(['data' => $this->serialize($config)]);
    }

    private function serialize(SsoConfiguration $config): array
    {
        return [
            'id' => $config->id,
            'organization_id' => $config->organization_id,
            'provider_type' => $config->provider_type,
            'is_enabled' => $config->is_enabled,
            'entity_id' => $config->entity_id,
            'sso_url' => $config->sso_url,
            'attribute_mapping' => $config->attribute_mapping,
            'allowed_domains' => $config->allowed_domains,
            'created_at' => $config->created_at?->toIso8601String(),
            'updated_at' => $config->updated_at?->toIso8601String(),
            // certificate and client_secret_enc are intentionally omitted
        ];
    }
}
