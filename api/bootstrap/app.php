<?php

use App\Http\Middleware\AuthenticateApiKey;
use App\Http\Middleware\CheckFeatureAccess;
use App\Http\Middleware\EnsureOnboardingComplete;
use App\Http\Middleware\EnsurePlatformAdmin;
use App\Http\Middleware\EnsurePlatformToken;
use App\Http\Middleware\EnsureTenantToken;
use App\Http\Middleware\EnsureTenantUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // Platform API — Command Center routes (/api/platform/v1/*)
            // Separate from tenant API (/api/v1/*). Uses the platform_admin guard.
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/platform.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'platform.admin' => EnsurePlatformAdmin::class,
            'platform.auth' => EnsurePlatformToken::class,
            'tenant.user' => EnsureTenantUser::class,
            'tenant.auth' => EnsureTenantToken::class,
            'feature' => CheckFeatureAccess::class,
            'auth.api_key' => AuthenticateApiKey::class,
            'onboarding.complete' => EnsureOnboardingComplete::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*'));
    })->create();
