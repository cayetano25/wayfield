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
use App\Http\Controllers\Api\V1\Platform\PaymentControlController;
use App\Http\Controllers\Api\V1\Platform\PlatformPaymentController;
use App\Http\Controllers\Api\V1\Platform\PlatformWorkshopAuditController;
use App\Http\Controllers\Api\V1\Platform\PlatformSecurityController;
use App\Http\Controllers\Api\V1\Platform\PlatformSsoController;
use App\Http\Controllers\Api\V1\Platform\PlatformSupportController;
use App\Http\Controllers\Api\V1\Platform\PlatformUserController;
use App\Http\Controllers\Api\V1\Platform\PlatformWebhookController;
use App\Http\Controllers\Platform\V1\OverviewController;
use App\Http\Controllers\Platform\V1\PlatformAuthController;
use App\Http\Controllers\Platform\V1\TwoFactorChallengeController;
use App\Http\Controllers\Platform\V1\TwoFactorManagementController;
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

    // 2FA challenge — intermediate step between login and full token issuance.
    // No Sanctum auth; validated by the short-lived two_factor_session_token (cache).
    Route::post('auth/two-factor',          [TwoFactorChallengeController::class, 'verify'])
        ->middleware('throttle:10,1');
    Route::post('auth/two-factor/recovery', [TwoFactorChallengeController::class, 'recovery'])
        ->middleware('throttle:10,1');

    // ─── Protected platform routes ────────────────────────────────────────────
    Route::middleware(['auth:platform_admin', 'platform.admin'])->group(function () {

        // Auth
        Route::post('auth/logout', [PlatformAuthController::class, 'logout']);
        Route::get('auth/me', [PlatformAuthController::class, 'me']);

        // 2FA management (self-service — any authenticated platform admin)
        Route::get('auth/two-factor/setup',                          [TwoFactorManagementController::class, 'setup']);
        Route::post('auth/two-factor/confirm',                       [TwoFactorManagementController::class, 'confirm']);
        Route::post('auth/two-factor/disable',                       [TwoFactorManagementController::class, 'disable']);
        Route::post('auth/two-factor/recovery-codes/regenerate',     [TwoFactorManagementController::class, 'regenerateRecoveryCodes']);

        // 2FA admin override — super_admin only (enforced in controller)
        Route::post('admins/{id}/two-factor/disable', [TwoFactorManagementController::class, 'disableForAdmin']);

        // Overview dashboard
        Route::get('overview', [OverviewController::class, 'index']);

        // Organizations
        Route::get('organizations', [PlatformOrganizationController::class, 'index']);
        Route::get('organizations/{organization}', [PlatformOrganizationController::class, 'show']);
        Route::get('organizations/{id}/leader-completion', [PlatformOrganizationController::class, 'leaderCompletion']);
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

        // Workshop audit — read-only, all authenticated admins
        Route::get('workshops/pricing-audit', [PlatformWorkshopAuditController::class, 'pricingAudit']);
        Route::get('workshops/readiness', [PlatformWorkshopAuditController::class, 'readiness']);
        Route::get('workshops/addon-pricing', [PlatformWorkshopAuditController::class, 'addonPricing']);

        // Financials — super_admin and billing only
        Route::middleware('platform.admin:super_admin,billing')->group(function () {
            Route::get('financials/overview', [PlatformFinancialController::class, 'overview']);
            Route::get('financials/invoices', [PlatformFinancialController::class, 'invoices']);
            Route::get('financials/refund-policies', [PlatformFinancialController::class, 'refundPolicies']);
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

        // Payment controls — readable by all authenticated admins; mutations check roles in controller
        Route::get('payments/status', [PaymentControlController::class, 'status']);
        Route::get('payments/take-rates', [PaymentControlController::class, 'takeRates']);
        Route::get('payments/connect-accounts', [PaymentControlController::class, 'connectAccounts']);
        Route::get('payments/connect-accounts/{organization_id}', [PaymentControlController::class, 'connectAccountDetail']);
        Route::post('payments/enable', [PaymentControlController::class, 'enablePlatform']);
        Route::post('payments/disable', [PaymentControlController::class, 'disablePlatform']);
        Route::patch('payments/take-rates/{plan_code}', [PaymentControlController::class, 'updateTakeRate']);
        Route::get('organizations/{id}/payments', [PaymentControlController::class, 'orgStatus']);
        Route::post('organizations/{id}/payments/enable', [PaymentControlController::class, 'enableOrg']);
        Route::post('organizations/{id}/payments/disable', [PaymentControlController::class, 'disableOrg']);
        Route::patch('organizations/{id}/payments/flags/{flag_key}', [PaymentControlController::class, 'setOrgFlag']);

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
