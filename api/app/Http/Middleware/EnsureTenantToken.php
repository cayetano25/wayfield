<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces that tenant routes are only accessible via User tokens.
 *
 * Per ROLE_MODEL.md Section 1: platform tokens must be rejected on tenant routes.
 * Sanctum resolves tokens polymorphically — an AdminUser token satisfies auth:sanctum
 * unless this middleware explicitly rejects it.
 *
 * Only runs the check when a bearer token is present; unauthenticated requests
 * are handled by the auth:sanctum middleware returning 401 before this runs.
 *
 * Alias: tenant.auth
 */
class EnsureTenantToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken() && ! ($request->user() instanceof User)) {
            return response()->json([
                'error' => 'tenant_auth_required',
                'message' => 'This endpoint requires a tenant user token.',
            ], 403);
        }

        return $next($request);
    }
}
