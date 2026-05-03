<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Platform\PlatformAdminUserController;
use App\Http\Controllers\Api\V1\Platform\PlatformAnnouncementController;
use App\Http\Controllers\Api\V1\Platform\PlatformAuditController;
use App\Http\Controllers\Api\V1\Platform\PlatformAutomationController;
use App\Http\Controllers\Api\V1\Platform\PlatformConfigController;
use App\Http\Controllers\Api\V1\Platform\PlatformFinancialController;
use App\Http\Controllers\Api\V1\Platform\PlatformHealthController;
use App\Http\Controllers\Api\V1\Platform\PlatformOrganizationController;
use App\Http\Controllers\Api\V1\Platform\PlatformPaymentController;
use App\Http\Controllers\Api\V1\Platform\PlatformSecurityController;
use App\Http\Controllers\Api\V1\Platform\PlatformSsoController;
use App\Http\Controllers\Api\V1\Platform\PlatformSupportController;
use App\Http\Controllers\Api\V1\Platform\PlatformUserController;
use App\Http\Controllers\Api\V1\Platform\PlatformWebhookController;
use App\Http\Controllers\Platform\V1\OverviewController;
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

        // Auth
        Route::post('auth/logout', [PlatformAuthController::class, 'logout']);
        Route::get('auth/me', [PlatformAuthController::class, 'me']);

        // Overview dashboard
        Route::get('overview', [OverviewController::class, 'index']);

        // Organizations
        Route::get('organizations', [PlatformOrganizationController::class, 'index']);
        Route::get('organizations/{organization}', [PlatformOrganizationController::class, 'show']);
        Route::patch('organizations/{organization}/status', [PlatformOrganizationController::class, 'updateStatus']);
        Route::get('organizations/{organization}/feature-flags', [PlatformOrganizationController::class, 'featureFlags']);

        // Organization mutations — super_admin, admin, billing only
        Route::middleware('platform.admin:super_admin,admin,billing')->group(function () {
            Route::post('organizations/{organization}/billing/plan', [PlatformOrganizationController::class, 'changePlan']);
        });

        // Feature flag overrides — super_admin and admin only
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::post('organizations/{organization}/feature-flags', [PlatformOrganizationController::class, 'setFeatureFlag']);
        });

        // Users
        Route::get('users', [PlatformUserController::class, 'index']);
        Route::get('users/{user}', [PlatformUserController::class, 'show']);

        // Audit logs — super_admin and admin only
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::get('audit-logs', [PlatformAuditController::class, 'index']);
        });

        // Support tickets
        Route::get('support/tickets', [PlatformSupportController::class, 'index']);
        Route::get('support/tickets/{ticket}', [PlatformSupportController::class, 'show']);
        Route::patch('support/tickets/{ticket}', [PlatformSupportController::class, 'update']);
        Route::post('support/tickets/{ticket}/messages', [PlatformSupportController::class, 'addMessage']);

        // Financials — super_admin and billing only
        Route::middleware('platform.admin:super_admin,billing')->group(function () {
            Route::get('financials/overview', [PlatformFinancialController::class, 'overview']);
            Route::get('financials/invoices', [PlatformFinancialController::class, 'invoices']);
        });

        // System health — super_admin and admin only
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::get('health', [PlatformHealthController::class, 'index']);
            Route::get('health/security-events', [PlatformHealthController::class, 'securityEvents']);
            Route::get('health/login-events', [PlatformHealthController::class, 'loginEvents']);
        });

        // SSO configuration — read: any admin; write: super_admin and admin only
        Route::get('organizations/{organization}/sso', [PlatformSsoController::class, 'show']);
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::put('organizations/{organization}/sso', [PlatformSsoController::class, 'update']);
        });

        // Webhook visibility
        Route::get('organizations/{organization}/webhooks', [PlatformWebhookController::class, 'index']);

        // Payment admin — super_admin and admin only
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::post('organizations/{organization}/enable-payments', [PlatformPaymentController::class, 'enablePayments']);
            Route::post('organizations/{organization}/disable-payments', [PlatformPaymentController::class, 'disablePayments']);
        });

        // System Announcements
        Route::get('system-announcements', [PlatformAnnouncementController::class, 'index']);
        Route::post('system-announcements', [PlatformAnnouncementController::class, 'store']);
        Route::patch('system-announcements/{announcement}', [PlatformAnnouncementController::class, 'update']);
        Route::delete('system-announcements/{announcement}', [PlatformAnnouncementController::class, 'destroy']);

        // Automations — read: any admin; write: super_admin and admin only
        Route::get('automations', [PlatformAutomationController::class, 'index']);
        Route::get('automations/{id}', [PlatformAutomationController::class, 'show']);
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::post('automations', [PlatformAutomationController::class, 'store']);
            Route::patch('automations/{id}', [PlatformAutomationController::class, 'update']);
            Route::delete('automations/{id}', [PlatformAutomationController::class, 'destroy']);
        });

        // Security events — super_admin and admin only
        Route::middleware('platform.admin:super_admin,admin')->group(function () {
            Route::get('security/events', [PlatformSecurityController::class, 'index']);
        });

        // Platform config — read: any admin; write: super_admin only
        Route::get('config', [PlatformConfigController::class, 'index']);
        Route::put('config/{key}', [PlatformConfigController::class, 'update']);

        // Admin user management — super_admin only
        Route::get('admins', [PlatformAdminUserController::class, 'index']);
        Route::post('admins', [PlatformAdminUserController::class, 'store']);
        Route::patch('admins/{id}/role', [PlatformAdminUserController::class, 'updateRole']);
        Route::patch('admins/{id}/status', [PlatformAdminUserController::class, 'updateStatus']);

        // Impersonation stub — super_admin only; not yet active
        Route::post('impersonate/{organization}', function () {
            return response()->json(['message' => 'Not implemented.'], 501);
        })->middleware('platform.admin:super_admin');
    });
});
