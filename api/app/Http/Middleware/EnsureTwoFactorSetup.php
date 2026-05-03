<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * If two_factor_required = true on an admin account, block all requests
 * until 2FA is configured. Returns a specific error code so the frontend
 * can redirect to the setup screen.
 *
 * Applied AFTER auth:platform_admin and platform.admin so $user is guaranteed.
 * Must NOT be applied to /auth/two-factor/setup or /auth/two-factor/confirm,
 * otherwise a required-but-unconfigured admin can never reach setup.
 */
class EnsureTwoFactorSetup
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user('platform_admin');

        if ($user && $user->two_factor_required && ! $user->hasTwoFactorEnabled()) {
            return response()->json([
                'error'   => 'two_factor_setup_required',
                'message' => 'This account requires two-factor authentication to be configured.',
            ], 403);
        }

        return $next($request);
    }
}
