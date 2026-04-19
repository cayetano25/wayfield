<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards routes that require the user to have completed onboarding.
 *
 * Apply to admin/dashboard and participant/workshop routes — never to
 * /onboarding/* routes themselves.
 *
 * Per AR-3: only users with onboarding_completed_at set are considered done.
 * Users who pre-date the onboarding wizard are handled by the backfill migration
 * (their onboarding_completed_at is set to their created_at at deploy time).
 */
class EnsureOnboardingComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->hasCompletedOnboarding()) {
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'onboarding_required',
                    'redirect' => '/onboarding',
                    'message' => 'Please complete your account setup first.',
                ], 403);
            }

            return redirect('/onboarding');
        }

        return $next($request);
    }
}
