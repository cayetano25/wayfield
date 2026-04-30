<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Attempts Sanctum authentication when a Bearer token is present.
 * Never rejects unauthenticated requests — guests pass through unchanged.
 * When auth succeeds, calls Auth::shouldUse('sanctum') so that auth()->check()
 * and auth()->id() work correctly in resources and controllers downstream.
 *
 * Use on public routes that return personalised data (is_favorited, participant_status)
 * for logged-in users but are also fully accessible to guests.
 */
class AttemptSanctumAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->bearerToken()) {
            $user = Auth::guard('sanctum')->user();
            if ($user instanceof User) {
                Auth::shouldUse('sanctum');
            }
        }

        return $next($request);
    }
}
