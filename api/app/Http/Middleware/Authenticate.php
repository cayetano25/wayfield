<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    // Pure API app — never redirect to a login page.
    // Returning null causes Laravel to throw AuthenticationException → 401 JSON.
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
