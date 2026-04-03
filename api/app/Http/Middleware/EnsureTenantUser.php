<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reject non-User tokens on tenant API routes.
 *
 * Sanctum resolves tokens polymorphically — an AdminUser token can satisfy
 * auth:sanctum unless this middleware explicitly rejects it. This ensures
 * that platform_admin tokens cannot access the tenant API (/api/v1/*).
 */
class EnsureTenantUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! ($request->user() instanceof User)) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
