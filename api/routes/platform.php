<?php

use App\Http\Controllers\Platform\V1\PlatformAuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Platform API Routes — /api/platform/v1
|--------------------------------------------------------------------------
|
| These routes serve the Wayfield Command Center exclusively.
| Authentication uses the platform_admin Sanctum guard (AdminUser model).
|
| Tenant tokens (tokenable_type = User) are rejected by auth:platform_admin.
| Platform tokens are rejected by auth:sanctum on tenant routes.
|
| All protected routes additionally run through EnsurePlatformAdmin (platform.admin)
| which checks is_active and optional role constraints.
|
*/

Route::prefix('platform/v1')->group(function () {

    // ─── Auth (unauthenticated) ───────────────────────────────────────────────
    Route::post('auth/login', [PlatformAuthController::class, 'login'])
        ->middleware('throttle:10,1');

    // ─── Protected platform routes ────────────────────────────────────────────
    Route::middleware(['auth:platform_admin', 'platform.admin'])->group(function () {
        Route::post('auth/logout', [PlatformAuthController::class, 'logout']);
        Route::get('auth/me', [PlatformAuthController::class, 'me']);

        // ─── Impersonation stub (not yet active) ─────────────────────────────
        // Wired so any future activation automatically inherits audit logging.
        // Returns 501 until the feature is explicitly enabled.
        Route::post('impersonate/{organization}', function () {
            return response()->json(['message' => 'Not implemented.'], 501);
        })->middleware('platform.admin:super_admin');
    });
});
