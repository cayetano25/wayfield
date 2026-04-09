<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\AdminUser;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces that platform routes are only accessible via AdminUser tokens.
 *
 * Per ROLE_MODEL.md Section 1: tenant tokens must be rejected on platform routes.
 * This middleware is used with auth:sanctum (which can resolve any token type) and
 * explicitly rejects any authenticated user that is not an AdminUser.
 *
 * Alias: platform.auth
 */
class EnsurePlatformToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof AdminUser) {
            return response()->json([
                'error' => 'platform_auth_required',
                'message' => 'This endpoint requires a platform admin token.',
            ], 403);
        }

        if (! $user->is_active) {
            return response()->json([
                'error' => 'account_inactive',
                'message' => 'This admin account has been deactivated.',
            ], 403);
        }

        return $next($request);
    }
}
