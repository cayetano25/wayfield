<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Shared\Services\AuditLogService;
use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * Manages API keys for an organization.
 *
 * Key format: wf_live_{48 random chars} in production,
 *             wf_test_{48 random chars} in local/staging.
 *
 * The raw key is returned only once on creation and is never stored.
 * Only the SHA256 hash is persisted to api_keys.key_hash.
 *
 * Creating and revoking keys requires the 'owner' role (not just admin),
 * since API keys grant external programmatic access.
 */
class ApiKeyController extends Controller
{
    /**
     * GET /api/v1/organizations/{organization}/api-keys
     *
     * Lists API keys. Never returns key_hash or the full key.
     * Requires owner or admin.
     */
    public function index(Organization $organization): JsonResponse
    {
        $this->authorizeOwnerOrAdmin($organization);

        $keys = ApiKey::where('organization_id', $organization->id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ApiKey $k) => $this->serialize($k));

        return response()->json(['data' => $keys]);
    }

    /**
     * POST /api/v1/organizations/{organization}/api-keys
     *
     * Creates a new API key. Returns the raw key exactly once.
     * Requires owner role only (not admin — external access is high-trust).
     */
    public function store(Request $request, Organization $organization): JsonResponse
    {
        $this->authorizeOwner($organization);

        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'scopes'     => ['required', 'array', 'min:1'],
            'scopes.*'   => ['required', 'string', 'in:' . implode(',', ApiKey::ALL_SCOPES)],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $prefix  = app()->isProduction() ? 'wf_live_' : 'wf_test_';
        $rawKey  = $prefix . Str::random(48);
        $keyHash = hash('sha256', $rawKey);

        $key = ApiKey::create([
            'organization_id'    => $organization->id,
            'name'               => $validated['name'],
            'key_prefix'         => substr($rawKey, 0, 10),
            'key_hash'           => $keyHash,
            'scopes'             => $validated['scopes'],
            'is_active'          => true,
            'expires_at'         => $validated['expires_at'] ?? null,
            'created_by_user_id' => Auth::id(),
        ]);

        return response()->json([
            'data'    => $this->serialize($key),
            'raw_key' => $rawKey,
            'notice'  => 'Store this key securely. It will not be shown again.',
        ], 201);
    }

    /**
     * DELETE /api/v1/organizations/{organization}/api-keys/{key}
     *
     * Revokes an API key (sets is_active = false).
     * Requires owner role only.
     */
    public function destroy(Organization $organization, ApiKey $apiKey): JsonResponse
    {
        $this->authorizeOwner($organization);

        if ($apiKey->organization_id !== $organization->id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $apiKey->update(['is_active' => false]);

        AuditLogService::record([
            'organization_id' => $organization->id,
            'actor_user_id'   => Auth::id(),
            'entity_type'     => 'api_key',
            'entity_id'       => $apiKey->id,
            'action'          => 'api_key_revoked',
            'metadata'        => ['key_name' => $apiKey->name, 'key_prefix' => $apiKey->key_prefix],
        ]);

        return response()->json(['message' => 'API key revoked.']);
    }

    private function serialize(ApiKey $key): array
    {
        return [
            'id'           => $key->id,
            'name'         => $key->name,
            'key_prefix'   => $key->key_prefix,
            'scopes'       => $key->scopes,
            'is_active'    => $key->is_active,
            'last_used_at' => $key->last_used_at?->toIso8601String(),
            'expires_at'   => $key->expires_at?->toIso8601String(),
            'created_at'   => $key->created_at?->toIso8601String(),
        ];
    }

    private function authorizeOwnerOrAdmin(Organization $organization): void
    {
        $user     = Auth::user();
        $isMember = $organization->organizationUsers()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->where('is_active', true)
            ->exists();

        if (! $isMember) {
            abort(403, 'Requires owner or admin role.');
        }
    }

    private function authorizeOwner(Organization $organization): void
    {
        $user    = Auth::user();
        $isOwner = $organization->organizationUsers()
            ->where('user_id', $user->id)
            ->where('role', 'owner')
            ->where('is_active', true)
            ->exists();

        if (! $isOwner) {
            abort(403, 'Requires owner role.');
        }
    }
}
