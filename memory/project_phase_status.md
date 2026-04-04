---
name: Phase Build Status
description: Current implementation phase, what's done, key decisions and gotchas
type: project
---

# Wayfield API — Phase Build Status

Current phase complete: **Phase 8**
Working directory: `api/`

---

## Phases Complete

### Phase 0 — Scaffold
Laravel project, MySQL, Sanctum, env templates, CI baseline.

### Phase 1 — Identity, People, Tenant Foundation
- users, auth_methods, user_2fa_methods/recovery_codes, password_reset_tokens, user_sessions
- organizations, organization_users, subscriptions
- Email/password auth, email verification, password reset
- **Gotcha:** `password_hash` column (not `password`). Override `getAuthPassword()`/`getAuthPasswordName()` on User.
- **Gotcha:** Custom `password_reset_tokens` table (token_hash + expires_at). Not Laravel default.

### Phase 2 — Workshops, Locations, Public Pages
- locations, workshops, workshop_logistics, public_pages
- Workshop CRUD, status transitions (draft→published→archived)
- Role-aware API Resources (OrganizerWorkshopResource, PublicWorkshopResource)
- join_code unique + auto-generated

### Phase 3 — Sessions, Capacity, Selections, Virtual Delivery
- tracks, sessions, registrations, session_selections
- `capacity = NULL` means unlimited (never zero)
- Capacity enforced with `SELECT ... FOR UPDATE` (DB-level locking)
- `virtual_participation_allowed` flag on sessions (for hybrid)
- `meeting_url` required before publish for virtual/hybrid sessions
- `start_at`/`end_at` are DATETIME (stored UTC)
- sessions have NO `leader_id` FK — leaders via session_leaders table

### Phase 4 — Leaders, Invitations, Self-Managed Profiles
- leaders (global, reusable), organization_leaders, leader_invitations, workshop_leaders, session_leaders
- Invitation token stored as `invitation_token_hash` (hashed); raw token email-only
- `session_id` NOT on leader_invitations — post-acceptance assignment via session_leaders
- Public leader serializer: first/last name, bio, website, city, state_or_region only
- `LeaderInvitationMail` is a queued Mailable in `app/Mail/`

### Phase 5 — Attendance, Roster, Leader Messaging
- attendance_records (status: not_checked_in → checked_in/no_show)
- Participant self-check-in (requires registration + selection for session_based)
- Leader check-in/no-show (requires session_leaders assignment with assignment_status=accepted)
- RosterParticipantResource: phone visible only to assigned leaders + org owner/admin/staff
- Leader messaging: session_id required, leader assigned, time window in workshop timezone
- Time window: 4h before session.start_at to 2h after session.end_at (non-UTC workshop tz)
- session_leaders has `assignment_status` enum (added in Phase 5 migration)
- ALL leader notifications produce audit_logs records (mandatory)

### Phase 6 — Notifications, Push Tokens, Preferences, Email, 2FA Scaffolding
- push_tokens (UNIQUE on push_token, per-device, ios/android)
- notification_preferences (UNIQUE on user_id — one row per user)
- `Notification` and `NotificationRecipient` models/migrations existed from Phase 5
- **New services:**
  - `ResolveNotificationRecipientsService` — resolves by delivery_scope (all_participants/leaders/session_participants)
  - `QueueNotificationDeliveryAction` — dispatches SendEmailNotificationJob + SendPushNotificationJob
  - `CreateOrganizerNotificationAction` — organizer notification creation with audit log
- **custom delivery_scope is a PLACEHOLDER** — throws `CustomDeliveryNotImplementedException` (501)
- Preferences do NOT suppress urgent notifications or critical transactional emails
- Transactional emails (verification, reset, invitation) bypass notification_preferences entirely
- **Queued Mailable classes (all implement ShouldQueue):**
  - `EmailVerificationMail` — replaces old `VerifyEmailNotification` (still exists but unused)
  - `PasswordResetMail` — replaces old `ResetPasswordNotification` (still exists but unused)
  - `WorkshopJoinConfirmationMail` — dispatched on new registration
  - `WorkshopChangeNotificationMail` — for organizer workshop change notifications
  - `WorkshopNotificationMail` — generic, used by SendEmailNotificationJob
  - `LeaderInvitationMail` — Phase 4, unchanged
- **Markdown views** in `resources/views/mail/` (email-verification, password-reset, workshop-join-confirmation, workshop-change-notification)
- **2FA scaffolding:** `TwoFactorController` with 501 stubs at `auth/2fa/*` routes. No schema changes needed to activate.
- **Routes added:** me/notifications, me/notifications/{id}/read, me/push-tokens, me/notification-preferences, auth/2fa/*
- **WorkshopNotificationController** extended: now handles both organizer (delivery_scope required) and leader (session_id required) paths in store()

### Phase 7 — Offline Sync and Mobile Resilience
- offline_sync_snapshots, offline_action_queue migrations
- sync version hash (SHA-256) changes when workshop data changes
- meeting_url and phone numbers excluded from sync packages
- Leader sync package includes phone numbers only for their assigned sessions
- Idempotency via UNIQUE(client_action_uuid) on offline_action_queue
- OfflineSyncController handles sync-version, sync-package, offline-actions

### Phase 8 — Plan Enforcement, Feature Gating, and Reporting
- **`feature_flags` table**: org-level manual overrides (source = 'manual_override')
- **`ResolveOrganizationEntitlementsService`**: resolves plan + manual overrides; defaults to 'free' when no active subscription
- **`EnforceFeatureGateService`**: assertCanCreateWorkshop, assertCanAddParticipant, assertCanAddManager; null limit = unlimited
- **`CheckFeatureAccess` middleware**: alias `feature`, parameterized `->middleware('feature:reporting')`
- **Plan limits**:
  - Free: 2 active workshops, 75 participants/workshop, 1 manager
  - Starter: 10 active workshops, 250 participants/workshop, 5 managers
  - Pro/Enterprise: unlimited (null)
- "Active" workshops = status IN ('draft', 'published') — archived don't count
- Participant limit enforced in `RegistrationController::join()` on new registrations only (not re-activations)
- Workshop limit enforced in `CreateWorkshopAction::execute()` via `PlanLimitExceededException` → caught in controller → 403
- **Manual overrides**: only `role = 'owner'` may set; always produces audit_logs record with previous_value in metadata
- **Reporting routes**: attendance + workshops require `feature:reporting` (Starter+); usage available to all
- `JsonResource::withoutWrapping()` is global — no `data` envelope on resources
- `SubscriptionFactory` added (was missing); `FeatureFlagFactory` added
- `Subscription` model now has `HasFactory` trait

## Key Gotchas

- `NotificationRecipient.in_app_status` = 'pending' on creation, set to 'delivered' on first GET /me/notifications fetch, 'read' on explicit PATCH
- `PushToken` uses `updateOrCreate` on push_token value — one device one token, reassigns on re-register
- Notification preferences default to enabled without creating a DB row (firstOrNew pattern)
- `RegisterUserAction` and `RequestPasswordResetAction` now use `Mail::to()->queue()` not `$user->notify()`
- `RegistrationController::join()` dispatches `WorkshopJoinConfirmationMail` on new registration only (not re-activations)
- `SendPushNotificationJob` skips actual HTTP in local/testing environments (logs instead)
