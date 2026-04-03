<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformAdmin
{
    /**
     * Verify the authenticated token belongs to an active AdminUser.
     *
     * This middleware is applied AFTER auth:platform_admin has resolved the token.
     * Sanctum's platform_admin guard ensures the token's tokenable_type is AdminUser.
     * This middleware additionally verifies is_active and optional role constraints.
     *
     * Usage in routes:
     *   ->middleware('platform.admin')                       // any active platform admin
     *   ->middleware('platform.admin:super_admin')           // super_admin only
     *   ->middleware('platform.admin:billing,super_admin')   // billing or super_admin
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        /** @var \App\Models\AdminUser|null $adminUser */
        $adminUser = $request->user('platform_admin');

        if (! $adminUser) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $adminUser->is_active) {
            return response()->json(['message' => 'Account is inactive.'], 403);
        }

        if (! empty($roles) && ! in_array($adminUser->role, $roles, true)) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        return $next($request);
    }
}
