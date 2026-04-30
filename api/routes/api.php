<?php

use App\Http\Controllers\Api\V1\ContactController;
use App\Http\Controllers\Api\V1\AddressController;
use App\Http\Controllers\Api\V1\CartController;
use App\Http\Controllers\Api\V1\CouponController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\OrderHistoryController;
use App\Http\Controllers\Api\V1\ReceiptController;
use App\Http\Controllers\Api\V1\PublicWorkshopDiscoveryController;
use App\Http\Controllers\Api\V1\TaxonomyController;
use App\Http\Controllers\Api\V1\ApiKeyController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Auth\TwoFactorController;
use App\Http\Controllers\Api\V1\BillingController;
use App\Http\Controllers\Api\V1\RefundPolicyController;
use App\Http\Controllers\Api\V1\RefundRequestController;
use App\Http\Controllers\Api\V1\SessionPricingController;
use App\Http\Controllers\Api\V1\StripeConnectController;
use App\Http\Controllers\Api\V1\SesWebhookController;
use App\Http\Controllers\Api\V1\WaitlistPaymentController;
use App\Http\Controllers\Api\V1\WorkshopPriceTierController;
use App\Http\Controllers\Api\V1\WorkshopPricingController;
use App\Http\Controllers\Api\V1\StripeWebhookController;
use App\Http\Controllers\Api\V1\Platform\PlatformPaymentController;
use App\Http\Controllers\Webhooks\StripeWebhookController as StripeConnectWebhookController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DiscoveryController;
use App\Http\Controllers\Api\V1\ExternalApiController;
use App\Http\Controllers\Api\V1\JoinCodeController;
use App\Http\Controllers\Api\V1\JoinCodePreviewController;
use App\Http\Controllers\Api\V1\FeatureFlagController;
use App\Http\Controllers\Api\V1\FileUploadController;
use App\Http\Controllers\Api\V1\LeaderAdminController;
use App\Http\Controllers\Api\V1\LeaderDashboardController;
use App\Http\Controllers\Api\V1\LeaderInvitationController;
use App\Http\Controllers\Api\V1\LeaderSelfController;
use App\Http\Controllers\Api\V1\LeaderSelfEnrollController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MyScheduleController;
use App\Http\Controllers\Api\V1\NotificationPreferenceController;
use App\Http\Controllers\Api\V1\OfflineSyncController;
use App\Http\Controllers\Api\V1\OnboardingController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\OrganizationUserController;
use App\Http\Controllers\Api\V1\OrgInvitationController;
use App\Http\Controllers\Api\V1\OrgMemberController;
use App\Http\Controllers\Api\V1\ParticipantController;
use App\Http\Controllers\Api\V1\ParticipantDashboardController;
use App\Http\Controllers\Api\V1\PlansController;
use App\Http\Controllers\Api\V1\Platform\PlatformAnnouncementController;
use App\Http\Controllers\Api\V1\Platform\PlatformAuditController;
use App\Http\Controllers\Api\V1\Platform\PlatformFinancialController;
use App\Http\Controllers\Api\V1\Platform\PlatformHealthController;
use App\Http\Controllers\Api\V1\Platform\PlatformOrganizationController;
use App\Http\Controllers\Api\V1\Platform\PlatformSsoController;
use App\Http\Controllers\Api\V1\Platform\PlatformSupportController;
use App\Http\Controllers\Api\V1\Platform\PlatformUserController;
use App\Http\Controllers\Api\V1\Platform\PlatformWebhookController;
use App\Http\Controllers\Api\V1\ProfileController;
use App\Http\Controllers\Api\V1\PublicCategoryController;
use App\Http\Controllers\Api\V1\PublicDiscoverController;
use App\Http\Controllers\Api\V1\PublicLeaderController;
use App\Http\Controllers\Api\V1\PublicOrganizerController;
use App\Http\Controllers\Api\V1\PublicWorkshopController;
use App\Http\Controllers\Api\V1\SitemapController;
use App\Http\Controllers\Api\V1\PushTokenController;
use App\Http\Controllers\Api\V1\RegistrationController;
use App\Http\Controllers\Api\V1\ReportingController;
use App\Http\Controllers\Api\V1\ReportsController;
use App\Http\Controllers\Api\V1\RosterController;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\SessionNotificationController;
use App\Http\Controllers\Api\V1\SessionLeaderController;
use App\Http\Controllers\Api\V1\SessionParticipantController;
use App\Http\Controllers\Api\V1\SessionSelectionController;
use App\Http\Controllers\Api\V1\SsoController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\Api\V1\SystemAnnouncementController;
use App\Http\Controllers\Api\V1\TrackController;
use App\Http\Controllers\Api\V1\UserNotificationController;
use App\Http\Controllers\Api\V1\WebhookController;
use App\Http\Controllers\Api\V1\WorkshopAnalyticsController;
use App\Http\Controllers\Api\V1\WorkshopFavoritesController;
use App\Http\Controllers\Api\V1\WorkshopController;
use App\Http\Controllers\Api\V1\WorkshopLeaderController;
use App\Http\Controllers\Api\V1\WorkshopLogisticsController;
use App\Http\Controllers\Api\V1\WorkshopNotificationController;
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
        // Used by the invitation frontend to determine auth scenario (new vs. returning user).
        Route::get('check-email', [AuthController::class, 'checkEmail'])
            ->middleware('throttle:10,1');
    });

    // ─── Public taxonomy (no auth required) ──────────────────────────────────
    Route::get('taxonomy', [TaxonomyController::class, 'index']);
    Route::get('taxonomy/categories', [TaxonomyController::class, 'categories']);
    Route::get('taxonomy/categories/{category:slug}/subcategories', [TaxonomyController::class, 'subcategories']);

    // ─── Public endpoints (no auth required) ─────────────────────────────────
    Route::prefix('public')->group(function () {
        // Workshop listing (taxonomy-aware discovery) and detail.
        // auth.optional: enriches response with is_favorited/participant_status for logged-in users.
        Route::get('workshops', [PublicWorkshopDiscoveryController::class, 'index'])->middleware('auth.optional');
        Route::get('workshops/{slug}', [PublicWorkshopController::class, 'show'])->middleware('auth.optional');

        // Categories
        Route::get('categories', [PublicCategoryController::class, 'index']);
        Route::get('categories/{categorySlug}', [PublicCategoryController::class, 'show']);
        Route::get('categories/{categorySlug}/locations/{locationSlug}', [PublicCategoryController::class, 'byLocation']);

        // Leaders and organizers
        Route::get('leaders/{slug}', [PublicLeaderController::class, 'show']);
        Route::get('organizers/{slug}', [PublicOrganizerController::class, 'show']);

        // Sitemaps
        Route::get('sitemap/workshops', [SitemapController::class, 'workshops']);
        Route::get('sitemap/categories', [SitemapController::class, 'categories']);
        Route::get('sitemap/leaders', [SitemapController::class, 'leaders']);

        // Legacy discovery route kept for backwards compatibility
        Route::get('discover', [PublicDiscoverController::class, 'index']);
    });

    // Price tiers current — public-eligible; auth is optional for organizer enrichment.
    Route::get('workshops/{workshop}/price-tiers/current', [WorkshopPriceTierController::class, 'current']);

    // ─── Plans (public — no auth required) ───────────────────────────────────
    Route::get('plans', [PlansController::class, 'index']);

    // ─── Contact form (public — 3 per IP per hour) ────────────────────────────
    Route::post('contact', [ContactController::class, 'submit'])
        ->middleware('throttle:3,60');

    // ─── Stripe webhooks (no auth — signature verification inside controller) ─
    // Legacy route kept for backwards compatibility with existing Stripe config.
    Route::post('billing/webhook', [BillingController::class, 'webhook'])
        ->withoutMiddleware(['auth:sanctum', 'tenant.auth']);
    // New canonical webhook endpoint.
    Route::post('stripe/webhook', [StripeWebhookController::class, 'handle'])
        ->withoutMiddleware(['auth:sanctum', 'tenant.auth']);

    // ─── SSO Stub endpoints (Phase 9 — returns 501 until SSO is activated) ───
    Route::get('sso/{organization:slug}/login', [SsoController::class, 'login']);
    Route::post('sso/{organization:slug}/callback', [SsoController::class, 'callback']);

    // ─── Join code preview (no auth required, optional auth for user state) ────
    Route::get('join/{join_code}', [JoinCodePreviewController::class, 'show'])
        ->middleware('throttle:20,1');

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
    // URL shape: /leader-invitations/{token}
    // {token} is the raw secret — SHA-256 hashed and looked up via indexed column.
    Route::get('leader-invitations/{token}', [LeaderInvitationController::class, 'show']);
    Route::post('leader-invitations/{token}/decline', [LeaderInvitationController::class, 'decline']);

    // ─── Org member invitation resolution (public-but-tokenized) ─────────────
    // URL shape: /org-invitations/{token}
    // {token} is the raw secret — hashed and compared via hash_equals().
    Route::prefix('org-invitations/{token}')->group(function () {
        Route::get('', [OrgInvitationController::class, 'show']);
        Route::post('decline', [OrgInvitationController::class, 'decline']);
        // Accept requires authentication — the user must be logged in first.
        Route::middleware(['auth:sanctum', 'tenant.auth'])
            ->post('accept', [OrgInvitationController::class, 'accept']);
    });

    // ─── Address / country config (authenticated) ─────────────────────────────
    // Country config is static — safe to expose to any authenticated user.
    Route::middleware(['auth:sanctum', 'tenant.auth'])->group(function () {
        Route::get('address/countries', [AddressController::class, 'countries']);
        Route::get('address/countries/{code}', [AddressController::class, 'country']);
        Route::get('address/infer-country', [AddressController::class, 'inferCountry']);
    });

    // ─── Authenticated routes ─────────────────────────────────────────────────
    // tenant.auth (EnsureTenantToken) rejects platform AdminUser tokens with 403.
    Route::middleware(['auth:sanctum', 'tenant.auth'])->group(function () {

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

        // Participant personal dashboard — open to any authenticated user
        Route::get('me/dashboard', [ParticipantDashboardController::class, 'show']);

        // Leader personal dashboard
        Route::get('leader/dashboard', [LeaderDashboardController::class, 'show']);

        // Profile
        Route::get('me', [ProfileController::class, 'show']);
        Route::patch('me', [ProfileController::class, 'update']);
        Route::post('me/password', [ProfileController::class, 'changePassword']);
        Route::get('me/organizations', [ProfileController::class, 'organizations']);

        // Onboarding — step endpoints under /onboarding/*
        Route::prefix('onboarding')->group(function () {
            Route::get('status', [OnboardingController::class, 'status']);
            Route::patch('profile', [OnboardingController::class, 'updateProfile']);
            Route::post('complete', [OnboardingController::class, 'complete']);
        });

        // Legacy onboarding route (kept for backwards compatibility)
        Route::post('me/onboarding/complete', [OnboardingController::class, 'complete']);

        // Organizations
        Route::get('organizations/{organization}/dashboard', [DashboardController::class, 'index'])
            ->middleware('onboarding.complete');
        Route::get('organizations', [OrganizationController::class, 'index']);
        Route::post('organizations', [OrganizationController::class, 'store']);
        Route::get('organizations/{organization}', [OrganizationController::class, 'show']);
        Route::patch('organizations/{organization}', [OrganizationController::class, 'update']);

        // Organization members (legacy /users routes — kept for backward compat)
        Route::get('organizations/{organization}/users', [OrganizationUserController::class, 'index']);
        Route::post('organizations/{organization}/users', [OrganizationUserController::class, 'store']);
        Route::patch('organizations/{organization}/users/{organizationUser}', [OrganizationUserController::class, 'update']);

        // ─── Org members (canonical /members routes) ──────────────────────────
        Route::prefix('organizations/{organization}/members')->group(function () {
            Route::get('', [OrgMemberController::class, 'index']);
            Route::patch('{organizationUser}', [OrgMemberController::class, 'changeRole']);
            Route::delete('{organizationUser}', [OrgMemberController::class, 'remove']);
        });

        // ─── Org member invitations ───────────────────────────────────────────
        Route::prefix('organizations/{organization}/invitations')->group(function () {
            Route::get('', [OrgInvitationController::class, 'index']);
            Route::post('', [OrgInvitationController::class, 'store']);
            Route::delete('{invitation}', [OrgInvitationController::class, 'destroy']);
            Route::post('{invitation}/resend', [OrgInvitationController::class, 'resend']);
        });

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
        Route::get('workshops/{workshop}/analytics', [WorkshopAnalyticsController::class, 'show']);

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
        Route::delete('workshops/{workshop}/participants/{user}', [ParticipantController::class, 'destroy']);
        Route::post('workshops/{workshop}/rotate-join-code', [JoinCodeController::class, 'rotate']);
        // Participant search across all org workshops (for organizer add-to-session flow)
        Route::get('organizations/{organization}/participants/search', [ParticipantController::class, 'search'])
            ->name('org-participants.search');

        // Workshop favorites (any authenticated user)
        Route::post('workshops/{workshop}/favorite', [WorkshopFavoritesController::class, 'toggle']);
        Route::get('workshops/{workshop}/is-favorited', [WorkshopFavoritesController::class, 'isFavorited']);
        Route::get('me/favorites', [WorkshopFavoritesController::class, 'favorites']);

        // Workshop join and registration (participant)
        // Note: join route must come before {workshop} routes to avoid conflict
        Route::post('workshops/join', [RegistrationController::class, 'join']);
        Route::get('workshops/{workshop}/registration', [RegistrationController::class, 'show']);
        Route::delete('workshops/{workshop}/registration', [RegistrationController::class, 'cancel']);

        // Session selection (participant)
        Route::get('workshops/{workshop}/selection-options', [SessionSelectionController::class, 'options']);
        Route::post('workshops/{workshop}/selections', [SessionSelectionController::class, 'store']);
        Route::delete('workshops/{workshop}/selections/{session}', [SessionSelectionController::class, 'destroy']);
        Route::get('workshops/{workshop}/my-selections', [SessionSelectionController::class, 'mySelections']);

        // My schedule (participant)
        Route::get('workshops/{workshop}/my-schedule', [MyScheduleController::class, 'show']);

        // ─── Leader invitation acceptance (requires auth) ─────────────────────
        Route::post('leader-invitations/{token}/accept', [LeaderInvitationController::class, 'accept']);

        // ─── Leader invitation rescind (organizer) ────────────────────────────
        Route::delete('leader-invitations/{invitation}', [LeaderInvitationController::class, 'destroy']);

        // ─── Leader self-enrollment (owner/admin) — must precede {leader} wildcard ─
        Route::post('organizations/{organization}/leaders/self-enroll', [LeaderSelfEnrollController::class, 'store']);
        Route::delete('organizations/{organization}/leaders/self-enroll', [LeaderSelfEnrollController::class, 'destroy']);
        Route::delete('workshops/{workshop}/leaders/self', [LeaderSelfEnrollController::class, 'destroyFromWorkshop']);

        // ─── Leader admin (organizer) ─────────────────────────────────────────
        Route::get('organizations/{organization}/leaders', [LeaderAdminController::class, 'index']);
        Route::get('organizations/{organization}/leaders/{leader}', [LeaderAdminController::class, 'show']);
        Route::post('organizations/{organization}/leaders/invitations', [LeaderAdminController::class, 'invite']);

        // ─── Leader self-service ──────────────────────────────────────────────
        Route::get('leader/profile', [LeaderSelfController::class, 'showProfile']);
        Route::patch('leader/profile', [LeaderSelfController::class, 'updateProfile']);
        Route::get('leader/sessions', [LeaderSelfController::class, 'sessions']);
        Route::get('leader/workshops', [LeaderSelfController::class, 'workshops']);

        // ─── Workshop/session leader assignment (organizer) ───────────────────
        Route::get('workshops/{workshop}/leaders', [WorkshopLeaderController::class, 'index']);
        Route::post('workshops/{workshop}/leaders', [WorkshopLeaderController::class, 'store']);
        Route::delete('workshops/{workshop}/leaders/{leader}', [WorkshopLeaderController::class, 'destroy']);
        Route::get('sessions/{session}/leaders', [SessionLeaderController::class, 'index']);
        Route::post('sessions/{session}/leaders', [SessionLeaderController::class, 'store']);
        Route::delete('sessions/{session}/leaders/{leader}', [SessionLeaderController::class, 'destroy']);
        Route::patch('sessions/{session}/leaders/{leader}', [SessionLeaderController::class, 'updateStatus']);

        // Session participant management — new session-scoped routes (addon sessions feature)
        Route::get('sessions/{session}/participants', [SessionParticipantController::class, 'index'])
            ->name('session-participants.index');
        Route::post('sessions/{session}/participants', [SessionParticipantController::class, 'store'])
            ->name('session-participants.store');
        Route::delete('sessions/{session}/participants/{user}', [SessionParticipantController::class, 'destroy'])
            ->name('session-participants.destroy');

        // Legacy workshop-scoped routes — kept for backward compatibility
        Route::post('workshops/{workshop}/sessions/{session}/participants', [SessionParticipantController::class, 'add'])
            ->name('session-participants.add');
        Route::delete('workshops/{workshop}/sessions/{session}/participants/{user}', [SessionParticipantController::class, 'removeParticipant'])
            ->name('session-participants.remove');

        // ─── Attendance (Phase 5) ─────────────────────────────────────────────
        // Participant self-check-in
        Route::post('sessions/{session}/check-in', [AttendanceController::class, 'selfCheckIn']);
        // Leader manual check-in and no-show
        Route::post('sessions/{session}/attendance/{user}/leader-check-in', [AttendanceController::class, 'leaderCheckIn']);
        Route::post('sessions/{session}/attendance/{user}/no-show', [AttendanceController::class, 'markNoShow']);
        Route::patch('sessions/{session}/attendance/{user}/revert', [AttendanceController::class, 'revertAttendance']);

        // ─── Roster (Phase 5) ─────────────────────────────────────────────────
        Route::get('sessions/{session}/roster', [RosterController::class, 'sessionRoster']);
        Route::get('workshops/{workshop}/attendance-summary', [RosterController::class, 'workshopSummary']);

        // ─── Notifications (Phase 6) ──────────────────────────────────────────
        Route::get('workshops/{workshop}/notifications', [WorkshopNotificationController::class, 'index']);
        Route::post('workshops/{workshop}/notifications', [WorkshopNotificationController::class, 'store']);
        Route::get('workshops/{workshop}/notifications/{notification}', [WorkshopNotificationController::class, 'show']);

        // Leader session notifications — scoped to the session (no session_id in body)
        Route::post('sessions/{session}/notifications', [SessionNotificationController::class, 'store']);

        // In-app notifications for current user
        Route::get('me/notifications', [UserNotificationController::class, 'index']);
        Route::get('me/notifications/unread-count', [UserNotificationController::class, 'unreadCount']);
        Route::post('me/notifications/read-all', [UserNotificationController::class, 'readAll']);
        Route::patch('me/notifications/{notificationRecipient}/read', [UserNotificationController::class, 'markRead']);

        // Push token registration
        Route::post('me/push-tokens', [PushTokenController::class, 'store']);
        Route::delete('me/push-tokens/{pushToken}', [PushTokenController::class, 'destroy']);

        // Notification preferences
        Route::get('me/notification-preferences', [NotificationPreferenceController::class, 'show']);
        Route::put('me/notification-preferences', [NotificationPreferenceController::class, 'update']);

        // ─── Participant order history (Step 2) ───────────────────────────────
        Route::get('me/orders', [OrderHistoryController::class, 'orders']);
        Route::post('me/orders/{orderNumber}/resend-receipt', [OrderHistoryController::class, 'resendReceipt']);
        Route::get('me/orders/{orderNumber}/receipt', [ReceiptController::class, 'download'])
            ->name('api.me.orders.receipt');
        Route::get('me/orders/{orderNumber}', [OrderHistoryController::class, 'show']);

        // ─── Offline Sync (Phase 7) ───────────────────────────────────────────
        Route::get('workshops/{workshop}/sync-version', [OfflineSyncController::class, 'syncVersion']);
        Route::get('workshops/{workshop}/sync-package', [OfflineSyncController::class, 'syncPackage']);
        Route::post('workshops/{workshop}/offline-actions', [OfflineSyncController::class, 'replayActions']);

        // ─── Subscription / Entitlements (Phase 8) ───────────────────────────
        Route::get('organizations/{organization}/subscription', [SubscriptionController::class, 'show']);
        Route::get('organizations/{organization}/entitlements', [SubscriptionController::class, 'entitlements']);

        // ─── Billing (Phase 15 + in-app billing) ─────────────────────────────
        Route::get('organizations/{organization}/billing',                  [BillingController::class, 'index']);
        Route::post('organizations/{organization}/billing/setup-intent',    [BillingController::class, 'setupIntent']);
        Route::post('organizations/{organization}/billing/subscribe',       [BillingController::class, 'subscribe']);
        Route::post('organizations/{organization}/billing/cancel',          [BillingController::class, 'cancel']);
        Route::post('organizations/{organization}/billing/resume',          [BillingController::class, 'resume']);
        Route::get('organizations/{organization}/billing/portal',           [BillingController::class, 'billingPortal']);
        // Legacy checkout and status routes kept for backwards compatibility
        Route::post('organizations/{organization}/billing/checkout',        [BillingController::class, 'checkout']);
        Route::post('organizations/{organization}/billing/portal',          [BillingController::class, 'portal']);
        Route::get('organizations/{organization}/billing/status',           [BillingController::class, 'status']);

        // ─── Feature Flag Manual Override (Phase 8) ───────────────────────────
        Route::put('organizations/{organization}/feature-flags', [FeatureFlagController::class, 'update']);

        // ─── Reporting (Phase 8) ─────────────────────────────────────────────
        // Usage report is available to all plans.
        Route::get(
            'organizations/{organization}/reports/usage',
            [ReportingController::class, 'usage']
        );

        // ─── Enhanced Reports (Phase 15) ─────────────────────────────────────
        // All report endpoints require Starter+ — gated in ReportsController
        // (plan code always resolved from DB, never from request).
        Route::prefix('organizations/{organization}/reports')
            ->middleware('onboarding.complete')
            ->group(function () {
                Route::get('attendance', [ReportsController::class, 'attendance']);
                Route::get('workshops', [ReportsController::class, 'workshops']);
                Route::get('participants', [ReportsController::class, 'participants']);
                Route::get('export', [ReportsController::class, 'export']);
            });

        // ─── Webhooks (Phase 9) ───────────────────────────────────────────────
        Route::get('organizations/{organization}/webhooks', [WebhookController::class, 'index']);
        Route::post('organizations/{organization}/webhooks', [WebhookController::class, 'store']);
        Route::delete('organizations/{organization}/webhooks/{endpoint}', [WebhookController::class, 'destroy']);
        Route::get('organizations/{organization}/webhooks/{endpoint}/deliveries', [WebhookController::class, 'deliveries']);

        // ─── API Keys (Phase 9) ───────────────────────────────────────────────
        Route::get('organizations/{organization}/api-keys', [ApiKeyController::class, 'index']);
        Route::post('organizations/{organization}/api-keys', [ApiKeyController::class, 'store']);
        Route::delete('organizations/{organization}/api-keys/{apiKey}', [ApiKeyController::class, 'destroy']);

        // ─── Pricing & Refund Policies (Step 3A) ─────────────────────────────
        Route::get('workshops/{workshop}/pricing', [WorkshopPricingController::class, 'show']);
        Route::post('workshops/{workshop}/pricing', [WorkshopPricingController::class, 'store']);
        Route::put('workshops/{workshop}/pricing', [WorkshopPricingController::class, 'update']);
        Route::get('workshops/{workshop}/pricing/preview', [WorkshopPricingController::class, 'preview']);

        // ─── Price Tiers ─────────────────────────────────────────────────────
        Route::get('workshops/{workshop}/price-tiers', [WorkshopPriceTierController::class, 'index']);
        Route::post('workshops/{workshop}/price-tiers', [WorkshopPriceTierController::class, 'store']);
        Route::patch('workshops/{workshop}/price-tiers/{tier}', [WorkshopPriceTierController::class, 'update']);
        Route::delete('workshops/{workshop}/price-tiers/{tier}', [WorkshopPriceTierController::class, 'destroy']);
        Route::put('workshops/{workshop}/price-tiers/order', [WorkshopPriceTierController::class, 'reorder']);

        Route::get('sessions/{session}/pricing', [SessionPricingController::class, 'show']);
        Route::post('sessions/{session}/pricing', [SessionPricingController::class, 'store']);
        Route::put('sessions/{session}/pricing', [SessionPricingController::class, 'update']);
        Route::delete('sessions/{session}/pricing', [SessionPricingController::class, 'destroy']);

        Route::get('organizations/{organization}/refund-policy', [RefundPolicyController::class, 'showForOrganization']);
        Route::post('organizations/{organization}/refund-policy', [RefundPolicyController::class, 'storeForOrganization']);
        Route::put('organizations/{organization}/refund-policy', [RefundPolicyController::class, 'updateForOrganization']);

        Route::get('workshops/{workshop}/refund-policy', [RefundPolicyController::class, 'showForWorkshop']);
        Route::post('workshops/{workshop}/refund-policy', [RefundPolicyController::class, 'storeForWorkshop']);
        Route::put('workshops/{workshop}/refund-policy', [RefundPolicyController::class, 'updateForWorkshop']);

        // ─── Cart & Checkout (Step 4A) ────────────────────────────────────────
        Route::get('cart/{organization}', [CartController::class, 'show']);
        Route::post('cart/{organization}/items', [CartController::class, 'addItem']);
        Route::delete('cart/{organization}/items/{cartItem}', [CartController::class, 'removeItem']);
        Route::post('cart/{organization}/checkout', [CartController::class, 'checkout']);

        // ─── Cart coupon (participant apply / remove) ─────────────────────────
        Route::middleware('payments.enabled')->group(function () {
            Route::post('cart/{organization}/coupon', [CartController::class, 'applyCoupon']);
            Route::delete('cart/{organization}/coupon', [CartController::class, 'removeCoupon']);
        });

        // ─── Coupons — organizer management ──────────────────────────────────
        Route::middleware('payments.enabled')->group(function () {
            Route::get('organizations/{organization}/coupons/analytics', [CouponController::class, 'analytics']);
            Route::post('organizations/{organization}/coupons/bulk-generate', [CouponController::class, 'bulkGenerate']);
            Route::get('organizations/{organization}/coupons/export', [CouponController::class, 'export']);
            Route::get('organizations/{organization}/coupons', [CouponController::class, 'index']);
            Route::post('organizations/{organization}/coupons', [CouponController::class, 'store']);
            Route::get('organizations/{organization}/coupons/{coupon}', [CouponController::class, 'show']);
            Route::patch('organizations/{organization}/coupons/{coupon}', [CouponController::class, 'update']);
            Route::delete('organizations/{organization}/coupons/{coupon}', [CouponController::class, 'destroy']);
            Route::get('organizations/{organization}/coupons/{coupon}/redemptions', [CouponController::class, 'redemptions']);
            Route::get('workshops/{workshop}/coupons', [CouponController::class, 'indexForWorkshop']);
            Route::get('workshops/{workshop}/coupon-redemptions', [CouponController::class, 'workshopRedemptions']);
        });

        // ─── Waitlist payment window (Step 7A) ───────────────────────────────
        Route::get('workshops/{workshop:public_slug}/waitlist-payment-intent', [WaitlistPaymentController::class, 'show']);

        // ─── Orders (Step 4A / 5A) ───────────────────────────────────────────
        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/{order}', [OrderController::class, 'show']);
        Route::get('orders/{order}/balance-payment-intent', [OrderController::class, 'balancePaymentIntent']);
        Route::get('organizations/{organization}/orders', [OrderController::class, 'orgIndex']);

        // ─── Refunds & Disputes (Step 6A) ────────────────────────────────────
        Route::post('orders/{order}/refund-requests', [RefundRequestController::class, 'store']);
        Route::get('orders/{order}/refund-requests', [RefundRequestController::class, 'indexForOrder']);
        Route::get('organizations/{organization}/refund-requests', [RefundRequestController::class, 'indexForOrganization']);
        Route::post('refund-requests/{refundRequest}/approve', [RefundRequestController::class, 'approve']);
        Route::post('refund-requests/{refundRequest}/deny', [RefundRequestController::class, 'deny']);
        Route::post('refund-requests/{refundRequest}/issue-credit', [RefundRequestController::class, 'issueCredit']);

        // ─── Stripe Connect (Step 2A — payment onboarding) ───────────────────
        Route::middleware('payments.enabled')
            ->group(function () {
                Route::post(
                    'organizations/{organization}/stripe/connect',
                    [StripeConnectController::class, 'initiate']
                );
                Route::post(
                    'organizations/{organization}/stripe/refresh-link',
                    [StripeConnectController::class, 'refreshLink']
                );
            });
        // Status is readable without the payments gate so staff can see the
        // current connection state even before payments are formally enabled.
        Route::get(
            'organizations/{organization}/stripe/status',
            [StripeConnectController::class, 'status']
        );

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

            // ─── Payment admin (super_admin and admin only) ───────────────────
            Route::middleware('platform.admin:super_admin,admin')
                ->group(function () {
                    Route::post(
                        'organizations/{organization}/enable-payments',
                        [PlatformPaymentController::class, 'enablePayments']
                    );
                    Route::post(
                        'organizations/{organization}/disable-payments',
                        [PlatformPaymentController::class, 'disablePayments']
                    );
                });

            // System Announcements (Command Center)
            Route::get('system-announcements', [PlatformAnnouncementController::class, 'index']);
            Route::post('system-announcements', [PlatformAnnouncementController::class, 'store']);
            Route::patch('system-announcements/{announcement}', [PlatformAnnouncementController::class, 'update']);
            Route::delete('system-announcements/{announcement}', [PlatformAnnouncementController::class, 'destroy']);
        });
});

// ─── Stripe Connect webhooks (outside v1 prefix — no auth, signature-verified) ─
Route::post('webhooks/stripe', [StripeConnectWebhookController::class, 'handle'])
    ->withoutMiddleware(['auth:sanctum', 'tenant.auth']);
Route::post('webhooks/stripe/connect', [StripeConnectWebhookController::class, 'handleConnect'])
    ->withoutMiddleware(['auth:sanctum', 'tenant.auth']);

// ─── AWS SES delivery tracking via SNS (no auth — signature-verified inside) ─
Route::post('webhooks/ses', [SesWebhookController::class, 'handle'])
    ->withoutMiddleware(['auth:sanctum', 'tenant.auth']);

// ─── Test-only routes (local / testing environments only) ────────────────────
if (app()->environment(['testing', 'local'])) {
    Route::post('/testing/reset', function () {
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'E2ETestSeeder']);
        return response()->json(['reset' => true]);
    });

    Route::get('/testing/invitation-token/{invitationId}', function ($id) {
        $inv = \App\Models\LeaderInvitation::find($id);
        if (!$inv) {
            abort(404);
        }
        $rawToken = \Illuminate\Support\Str::random(64);
        $inv->update(['invitation_token_hash' => hash('sha256', $rawToken)]);
        return response()->json(['raw_token' => $rawToken]);
    });

    Route::get('/testing/org-invitation-token/{invitationId}', function ($id) {
        $inv = \App\Models\OrganizationInvitation::find($id);
        if (!$inv) {
            abort(404);
        }
        $rawToken = \Illuminate\Support\Str::random(64);
        $inv->update(['invitation_token_hash' => hash('sha256', $rawToken)]);
        return response()->json(['raw_token' => $rawToken]);
    });
}
