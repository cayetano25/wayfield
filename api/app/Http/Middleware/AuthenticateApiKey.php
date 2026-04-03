<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticate requests using an API key in the Authorization header.
 *
 * Expected header format: Authorization: ApiKey {full_key}
 *
 * Authentication flow:
 *   1. Extract raw key from the Authorization header.
 *   2. Hash with SHA256 and look up api_keys.key_hash.
 *   3. Validate is_active and expires_at.
 *   4. Enforce rate limit: 1000 req/hour per key (5 in test env).
 *   5. Attach organization and scopes to the request for controllers.
 *
 * On success: sets $request->apiKeyOrganization and $request->apiKeyScopes.
 * On failure: returns 401 or 429 JSON response without calling $next.
 */
class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization', '');

        if (! str_starts_with($authHeader, 'ApiKey ')) {
            return response()->json(['error' => 'invalid_api_key'], 401);
        }

        $rawKey  = substr($authHeader, strlen('ApiKey '));
        $keyHash = hash('sha256', $rawKey);

        $apiKey = ApiKey::with('organization')
            ->where('key_hash', $keyHash)
            ->first();

        if (! $apiKey) {
            return response()->json(['error' => 'invalid_api_key'], 401);
        }

        if (! $apiKey->is_active) {
            return response()->json(['error' => 'api_key_revoked'], 401);
        }

        if ($apiKey->isExpired()) {
            return response()->json(['error' => 'api_key_expired'], 401);
        }

        // Rate limiting — configurable per environment.
        // Uses Redis when available; falls back to cache driver in local dev.
        $limit     = (int) config('wayfield.api_key_rate_limit', 1000);
        $rateLimiterKey = 'api_key:' . $apiKey->id;

        if (RateLimiter::tooManyAttempts($rateLimiterKey, $limit)) {
            $retryAfter = RateLimiter::availableIn($rateLimiterKey);
            return response()->json(['error' => 'rate_limit_exceeded'], 429)
                ->header('Retry-After', $retryAfter);
        }

        // Decay window: 3600 seconds (1 hour)
        RateLimiter::hit($rateLimiterKey, 3600);

        // Update last_used_at without triggering model events
        ApiKey::where('id', $apiKey->id)->update(['last_used_at' => now()]);

        // Attach resolved context to request for controllers
        $request->merge([]);
        $request->apiKeyOrganization = $apiKey->organization;
        $request->apiKeyScopes       = $apiKey->scopes ?? [];

        return $next($request);
    }
}
