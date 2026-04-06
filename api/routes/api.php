<?php

use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\SystemAnnouncementController;
use App\Http\Controllers\Api\V1\Platform\PlatformAnnouncementController;
use App\Http\Controllers\Api\V1\FeatureFlagController;
use App\Http\Controllers\Api\V1\ReportingController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\TwoFactorController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\Platform\PlatformAuditController;
use App\Http\Controllers\Api\V1\Platform\PlatformFinancialController;
use App\Http\Controllers\Api\V1\Platform\PlatformHealthController;
use App\Http\Controllers\Api\V1\Platform\PlatformOrganizationController;
use App\Http\Controllers\Api\V1\Platform\PlatformSsoController;
use App\Http\Controllers\Api\V1\Platform\PlatformSupportController;
use App\Http\Controllers\Api\V1\Platform\PlatformUserController;
use App\Http\Controllers\Api\V1\Platform\PlatformWebhookController;
use App\Http\Controllers\Api\V1\PushTokenController;
use App\Http\Controllers\Api\V1\UserNotificationController;
use App\Http\Controllers\Api\V1\ApiKeyController;
use App\Http\Controllers\Api\V1\DiscoveryController;
use App\Http\Controllers\Api\V1\ExternalApiController;
use App\Http\Controllers\Api\V1\LeaderAdminController;
use App\Http\Controllers\Api\V1\LeaderInvitationController;
use App\Http\Controllers\Api\V1\LeaderSelfController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MyScheduleController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\OrganizationUserController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\PublicWorkshopController;
use App\Http\Controllers\Api\V1\RegistrationController;
use App\Http\Controllers\Api\V1\RosterController;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\SessionLeaderController;
use App\Http\Controllers\Api\V1\SessionParticipantController;
use App\Http\Controllers\Api\V1\SessionSelectionController;
use App\Http\Controllers\Api\V1\SsoController;
use App\Http\Controllers\Api\V1\TrackController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\WorkshopController;
use App\Http\Controllers\Api\V1\WorkshopLeaderController;
use App\Http\Controllers\Api\V1\WorkshopLogisticsController;
use App\Http\Controllers\Api\V1\WorkshopNotificationController;
use App\Http\Controllers\Api\V1\OfflineSyncController;
use App\Http\Controllers\Api\V1\FileUploadController;
use App\Http\Controllers\Api\V1\ParticipantController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ─── Auth (unauthenticated) ───────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('register', [AuthController::class, 'register'])
            ->middleware('throttle:10,1');
        Route::post('login', [AuthController::class, 'login'])
            ->middleware('throttle:10,1');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])
            ->middleware('throttle:5,1');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])
            ->middleware('throttle:5,1');
        Route::get('verify-email/{id}/{hash}', [AuthController::class, 'verifyEmail'])
            ->name('verification.verify');
    });

    // ─── Public endpoints (no auth required) ─────────────────────────────────
    Route::prefix('public')->group(function () {
        Route::get('workshops/{slug}', [PublicWorkshopController::class, 'show']);
    });

    // ─── SSO Stub endpoints (Phase 9 — returns 501 until SSO is activated) ───
    Route::get('sso/{organization:slug}/login', [SsoController::class, 'login']);
    Route::post('sso/{organization:slug}/callback', [SsoController::class, 'callback']);

    // ─── Public Workshop Discovery (no auth required) ─────────────────────────
    Route::prefix('discover')->group(function () {
        Route::get('workshops', [DiscoveryController::class, 'index']);
        Route::get('workshops/{slug}', [DiscoveryController::class, 'show']);
    });

    // ─── External API (API key authentication — not Sanctum) ─────────────────
    Route::middleware('auth.api_key')->prefix('external')->group(function () {
        Route::get('workshops', [ExternalApiController::class, 'workshops']);
        Route::get('workshops/{workshop}/sessions', [ExternalApiController::class, 'sessions']);
        Route::get('workshops/{workshop}/participants/count', [ExternalApiController::class, 'participantCount']);
    });

    // ─── Leader invitation resolve/decline (public-but-tokenized) ────────────
    // URL shape: /leader-invitations/{id}/{token}
    // {id} is the non-secret lookup key; {token} is the raw secret verified with hash_equals().
    Route::get('leader-invitations/{id}/{token}', [LeaderInvitationController::class, 'show']);
    Route::post('leader-invitations/{id}/{token}/decline', [LeaderInvitationController::class, 'decline']);

    // ─── Authenticated routes ─────────────────────────────────────────────────
    // tenant.user rejects platform AdminUser tokens — platform tokens must not work here
    Route::middleware(['auth:sanctum', 'tenant.user'])->group(function () {

        // Auth
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/resend-verification', [AuthController::class, 'resendVerification']);

        // 2FA scaffolding (Phase 6 — endpoints return 501 until activation phase)
        Route::prefix('auth/2fa')->group(function () {
            Route::get('status', [TwoFactorController::class, 'status']);
            Route::post('enable', [TwoFactorController::class, 'enable']);
            Route::post('confirm', [TwoFactorController::class, 'confirm']);
            Route::post('challenge', [TwoFactorController::class, 'challenge']);
            Route::post('disable', [TwoFactorController::class, 'disable']);
            Route::get('recovery-codes', [TwoFactorController::class, 'recoveryCodes']);
        });

        // Profile
        Route::get('me', [ProfileController::class, 'show']);
        Route::patch('me', [ProfileController::class, 'update']);
        Route::post('me/password', [ProfileController::class, 'changePassword']);
        Route::get('me/organizations', [ProfileController::class, 'organizations']);

        // Onboarding
        Route::post('me/onboarding/complete', [OnboardingController::class, 'complete']);

        // Organizations
        Route::get('organizations/{organization}/dashboard', [DashboardController::class, 'index']);
        Route::get('organizations', [OrganizationController::class, 'index']);
        Route::post('organizations', [OrganizationController::class, 'store']);
        Route::get('organizations/{organization}', [OrganizationController::class, 'show']);
        Route::patch('organizations/{organization}', [OrganizationController::class, 'update']);

        // Organization members
        Route::get('organizations/{organization}/users', [OrganizationUserController::class, 'index']);
        Route::post('organizations/{organization}/users', [OrganizationUserController::class, 'store']);
        Route::patch('organizations/{organization}/users/{organizationUser}', [OrganizationUserController::class, 'update']);

        // Locations
        Route::get('organizations/{organization}/locations', [LocationController::class, 'index']);
        Route::post('organizations/{organization}/locations', [LocationController::class, 'store']);
        Route::patch('locations/{location}', [LocationController::class, 'update']);
        Route::delete('locations/{location}', [LocationController::class, 'destroy']);

        // Workshops (organizer)
        Route::get('organizations/{organization}/workshops', [WorkshopController::class, 'index']);
        Route::post('organizations/{organization}/workshops', [WorkshopController::class, 'store']);
        Route::get('workshops/{workshop}', [WorkshopController::class, 'show']);
        Route::patch('workshops/{workshop}', [WorkshopController::class, 'update']);
        Route::post('workshops/{workshop}/publish', [WorkshopController::class, 'publish']);
        Route::post('workshops/{workshop}/archive', [WorkshopController::class, 'archive']);

        // Workshop logistics
        Route::get('workshops/{workshop}/logistics', [WorkshopLogisticsController::class, 'show']);
        Route::put('workshops/{workshop}/logistics', [WorkshopLogisticsController::class, 'upsert']);

        // Tracks
        Route::get('workshops/{workshop}/tracks', [TrackController::class, 'index']);
        Route::post('workshops/{workshop}/tracks', [TrackController::class, 'store']);
        Route::patch('tracks/{track}', [TrackController::class, 'update']);
        Route::delete('tracks/{track}', [TrackController::class, 'destroy']);

        // Sessions (organizer)
        Route::get('workshops/{workshop}/sessions', [SessionController::class, 'index']);
        Route::post('workshops/{workshop}/sessions', [SessionController::class, 'store']);
        Route::get('sessions/{session}', [SessionController::class, 'show']);
        Route::patch('sessions/{session}', [SessionController::class, 'update']);
        Route::post('sessions/{session}/publish', [SessionController::class, 'publish']);

        // Workshop participants (organizer/staff)
        Route::get('workshops/{workshop}/participants', [ParticipantController::class, 'index']);

        // Workshop join and registration (participant)
        // Note: join route must come before {workshop} routes to avoid conflict
        Route::post('workshops/join', [RegistrationController::class, 'join']);
        Route::get('workshops/{workshop}/registration', [RegistrationController::class, 'show']);
        Route::delete('workshops/{workshop}/registration', [RegistrationController::class, 'cancel']);

        // Session selection (participant)
        Route::get('workshops/{workshop}/selection-options', [SessionSelectionController::class, 'options']);
        Route::post('workshops/{workshop}/selections', [SessionSelectionController::class, 'store']);
        Route::delete('workshops/{workshop}/selections/{session}', [SessionSelectionController::class, 'destroy']);

        // My schedule (participant)
        Route::get('workshops/{workshop}/my-schedule', [MyScheduleController::class, 'show']);

        // ─── Leader invitation acceptance (requires auth) ─────────────────────
        Route::post('leader-invitations/{id}/{token}/accept', [LeaderInvitationController::class, 'accept']);

        // ─── Leader admin (organizer) ─────────────────────────────────────────
        Route::get('organizations/{organization}/leaders', [LeaderAdminController::class, 'index']);
        Route::post('organizations/{organization}/leaders/invitations', [LeaderAdminController::class, 'invite']);

        // ─── Leader self-service ──────────────────────────────────────────────
        Route::get('leader/profile', [LeaderSelfController::class, 'showProfile']);
        Route::patch('leader/profile', [LeaderSelfController::class, 'updateProfile']);
        Route::get('leader/sessions', [LeaderSelfController::class, 'sessions']);
        Route::get('leader/workshops', [LeaderSelfController::class, 'workshops']);

        // ─── Workshop/session leader assignment (organizer) ───────────────────
        Route::get('workshops/{workshop}/leaders', [WorkshopLeaderController::class, 'index']);
        Route::post('workshops/{workshop}/leaders', [WorkshopLeaderController::class, 'store']);
        Route::get('sessions/{session}/leaders', [SessionLeaderController::class, 'index']);
        Route::post('sessions/{session}/leaders', [SessionLeaderController::class, 'store']);
        Route::delete('sessions/{session}/leaders/{leader}', [SessionLeaderController::class, 'destroy']);
        Route::patch('sessions/{session}/leaders/{leader}', [SessionLeaderController::class, 'updateStatus']);

        // Session participant management (organizer)
        Route::delete('workshops/{workshop}/sessions/{session}/participants/{user}', [SessionParticipantController::class, 'removeParticipant'])
            ->name('session-participants.remove');

        // ─── Attendance (Phase 5) ─────────────────────────────────────────────
        // Participant self-check-in
        Route::post('sessions/{session}/check-in', [AttendanceController::class, 'selfCheckIn']);
        // Leader manual check-in and no-show
        Route::post('sessions/{session}/attendance/{user}/leader-check-in', [AttendanceController::class, 'leaderCheckIn']);
        Route::post('sessions/{session}/attendance/{user}/no-show', [AttendanceController::class, 'markNoShow']);

        // ─── Roster (Phase 5) ─────────────────────────────────────────────────
        Route::get('sessions/{session}/roster', [RosterController::class, 'sessionRoster']);
        Route::get('workshops/{workshop}/attendance-summary', [RosterController::class, 'workshopSummary']);

        // ─── Notifications (Phase 6) ──────────────────────────────────────────
        Route::get('workshops/{workshop}/notifications', [WorkshopNotificationController::class, 'index']);
        Route::post('workshops/{workshop}/notifications', [WorkshopNotificationController::class, 'store']);

        // In-app notifications for current user
        Route::get('me/notifications', [UserNotificationController::class, 'index']);
        Route::patch('me/notifications/{notificationRecipient}/read', [UserNotificationController::class, 'markRead']);

        // Push token registration
        Route::post('me/push-tokens', [PushTokenController::class, 'store']);
        Route::delete('me/push-tokens/{pushToken}', [PushTokenController::class, 'destroy']);

        // Notification preferences
        Route::get('me/notification-preferences', [NotificationPreferenceController::class, 'show']);
        Route::put('me/notification-preferences', [NotificationPreferenceController::class, 'update']);

        // ─── Offline Sync (Phase 7) ───────────────────────────────────────────
        Route::get('workshops/{workshop}/sync-version', [OfflineSyncController::class, 'syncVersion']);
        Route::get('workshops/{workshop}/sync-package', [OfflineSyncController::class, 'syncPackage']);
        Route::post('workshops/{workshop}/offline-actions', [OfflineSyncController::class, 'replayActions']);

        // ─── Subscription / Entitlements (Phase 8) ───────────────────────────
        Route::get('organizations/{organization}/subscription', [SubscriptionController::class, 'show']);
        Route::get('organizations/{organization}/entitlements', [SubscriptionController::class, 'entitlements']);

        // ─── Feature Flag Manual Override (Phase 8) ───────────────────────────
        Route::put('organizations/{organization}/feature-flags', [FeatureFlagController::class, 'update']);

        // ─── Reporting (Phase 8) ─────────────────────────────────────────────
        // Attendance and workshop reports require Starter+ (reporting feature).
        // Usage report is available to all plans.
        Route::get(
            'organizations/{organization}/reports/attendance',
            [ReportingController::class, 'attendance']
        )->middleware('feature:reporting');

        Route::get(
            'organizations/{organization}/reports/workshops',
            [ReportingController::class, 'workshops']
        )->middleware('feature:reporting');

        Route::get(
            'organizations/{organization}/reports/usage',
            [ReportingController::class, 'usage']
        );

        // ─── Webhooks (Phase 9) ───────────────────────────────────────────────
        Route::get('organizations/{organization}/webhooks', [WebhookController::class, 'index']);
        Route::post('organizations/{organization}/webhooks', [WebhookController::class, 'store']);
        Route::delete('organizations/{organization}/webhooks/{endpoint}', [WebhookController::class, 'destroy']);
        Route::get('organizations/{organization}/webhooks/{endpoint}/deliveries', [WebhookController::class, 'deliveries']);

        // ─── API Keys (Phase 9) ───────────────────────────────────────────────
        Route::get('organizations/{organization}/api-keys', [ApiKeyController::class, 'index']);
        Route::post('organizations/{organization}/api-keys', [ApiKeyController::class, 'store']);
        Route::delete('organizations/{organization}/api-keys/{apiKey}', [ApiKeyController::class, 'destroy']);

        // ─── System Announcements ─────────────────────────────────────────────
        Route::get('system/announcements', [SystemAnnouncementController::class, 'index'])
            ->name('system-announcements.index');

        // ─── File Uploads ─────────────────────────────────────────────────────
        Route::post('files/presigned-url', [FileUploadController::class, 'presignedUrl']);
        Route::post('files/confirm', [FileUploadController::class, 'confirm']);
    });

    // ─── Local file upload handler (local env only, no auth required) ───────────
    Route::post('files/local-upload', [FileUploadController::class, 'localUpload']);

    // ─── Platform Admin (Command Center — legacy v1 platform routes) ─────────
    // Auth: platform_admin guard (AdminUser tokens only — tenant tokens rejected).
    // Role values updated to match admin_users.role ENUM: admin, billing (not ops/finance).
    Route::prefix('platform')
        ->middleware(['auth:platform_admin', 'platform.admin'])
        ->group(function () {

            // Organizations
            Route::get('organizations', [PlatformOrganizationController::class, 'index']);
            Route::get('organizations/{organization}', [PlatformOrganizationController::class, 'show']);

            // Users
            Route::get('users', [PlatformUserController::class, 'index']);
            Route::get('users/{user}', [PlatformUserController::class, 'show']);

            // Audit logs (super_admin and admin only)
            Route::middleware('platform.admin:super_admin,admin')
                ->group(function () {
                    Route::get('audit-logs', [PlatformAuditController::class, 'index']);
                });

            // Support tickets
            Route::get('support/tickets', [PlatformSupportController::class, 'index']);
            Route::get('support/tickets/{ticket}', [PlatformSupportController::class, 'show']);
            Route::patch('support/tickets/{ticket}', [PlatformSupportController::class, 'update']);
            Route::post('support/tickets/{ticket}/messages', [PlatformSupportController::class, 'addMessage']);

            // Financials (super_admin and billing only)
            Route::middleware('platform.admin:super_admin,billing')
                ->group(function () {
                    Route::get('financials/invoices', [PlatformFinancialController::class, 'invoices']);
                    Route::get('financials/subscriptions', [PlatformFinancialController::class, 'subscriptions']);
                });

            // System health (super_admin and admin only)
            Route::middleware('platform.admin:super_admin,admin')
                ->group(function () {
                    Route::get('health', [PlatformHealthController::class, 'index']);
                    Route::get('health/security-events', [PlatformHealthController::class, 'securityEvents']);
                    Route::get('health/login-events', [PlatformHealthController::class, 'loginEvents']);
                });

            // SSO configuration (Phase 9)
            Route::get('organizations/{organization}/sso', [PlatformSsoController::class, 'show']);
            Route::middleware('platform.admin:super_admin,admin')
                ->group(function () {
                    Route::put('organizations/{organization}/sso', [PlatformSsoController::class, 'update']);
                });

            // Webhook visibility (Phase 9)
            Route::get('organizations/{organization}/webhooks', [PlatformWebhookController::class, 'index']);

            // System Announcements (Command Center)
            Route::get('system-announcements', [PlatformAnnouncementController::class, 'index']);
            Route::post('system-announcements', [PlatformAnnouncementController::class, 'store']);
            Route::patch('system-announcements/{announcement}', [PlatformAnnouncementController::class, 'update']);
            Route::delete('system-announcements/{announcement}', [PlatformAnnouncementController::class, 'destroy']);
        });
});
