<?php

namespace App\Http\Middleware;

use App\Models\PlatformAdmin;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformAdmin
{
    /**
     * Verify the authenticated user is an active platform admin.
     * Optionally restrict to specific roles by passing them as middleware parameters.
     *
     * Usage in routes:
     *   ->middleware('platform.admin')              // any active platform admin
     *   ->middleware('platform.admin:super_admin')  // super_admin only
     *   ->middleware('platform.admin:finance,super_admin')  // finance or super_admin
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $platformAdmin = PlatformAdmin::where('user_id', $user->id)
            ->where('is_active', true)
            ->first();

        if (! $platformAdmin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // If specific roles are required, check membership
        if (! empty($roles) && ! in_array($platformAdmin->role, $roles)) {
            return response()->json(['message' => 'Insufficient platform role.'], 403);
        }

        // Attach the PlatformAdmin record to the request for downstream use
        $request->attributes->set('platform_admin', $platformAdmin);

        return $next($request);
    }
}
