# API and Service Boundaries Specification
## docs/04_api/API_AND_SERVICE_BOUNDARIES.md

**Source authority:** `MASTER_PROMPT.md`
**Role authority:** `docs/02_domain/ROLE_MODEL.md`

---

## Purpose

Define the separation of concerns across backend service modules, API layers,
and authentication guards. This document governs how the codebase is organised
and where business logic lives.

---

## API Layers and Route Prefixes

Wayfield exposes three distinct API layers. Each has its own prefix, guard,
and audience. They are mutually exclusive — a token from one layer is always
rejected by another.

| Layer | Route prefix | Guard | Token type | Audience |
|---|---|---|---|---|
| Tenant API | `/api/v1/*` | `auth:sanctum` | `users` Sanctum token | Participants, Leaders, Org Members |
| Platform API | `/api/platform/v1/*` | `auth:platform_admin` | `admin_users` Sanctum token | Wayfield platform admins only |
| External API | `/api/v1/external/*` | API key header | `api_keys` secret hash | Third-party integrations |

The Platform API guard rejects all tenant tokens. The Tenant API guard rejects all
platform admin tokens. The External API verifies the `X-Api-Key` header against
`api_keys.secret_hash`. There is no shared session between layers.

---

## Public (Unauthenticated) Endpoints

Some Tenant API endpoints are accessible without authentication:

- Auth endpoints (register, login, forgot-password, reset-password, verify-email)
- Public workshop page: `GET /api/v1/public/workshops/{slug}`
- Workshop discovery: `GET /api/v1/discover/workshops`, `GET /api/v1/discover/workshops/{slug}`
- Leader invitation resolution: `GET /api/v1/leader-invitations/{token}`
- Organisation invitation resolution: `GET /api/v1/organization-invitations/{token}`
- Local dev file upload: `POST /api/v1/files/local-upload`

All other Tenant API routes require authentication.

---

## Tenant Service Modules

The tenant backend is organized into domain modules under `app/Domain/`.
Each module owns its tables, models, actions, services, policies, and resources.

### 1. Auth

Responsibilities: registration, login/logout, email verification, password reset,
token lifecycle, login event recording, SSO scaffolding.

Owns: Auth controllers/actions, VerifyEmailAction, RecordLoginEventService, SsoAuthService.

Depends on: Identity (users), Audit.

### 2. Identity

Responsibilities: user profile, auth method linkage, 2FA scaffolding, user session
metadata.

Owns: users, auth_methods, user_2fa_methods, user_2fa_recovery_codes, user_sessions.

Depends on: Audit.

### 3. Organizations

Responsibilities: organisation CRUD, primary contact, membership CRUD,
organisation invitation flow, tenant scoping helpers.

Owns: organizations, organization_users, organization_invitations.

Depends on: Identity (users), Subscriptions (entitlement lookups), Audit.

Key enforcement: At least one active `owner` must always exist. Last-owner checks
run in RemoveOrganizationMemberAction and UpdateOrganizationMemberRoleAction.

### 4. Subscriptions

Responsibilities: plan enrollment, feature flag resolution, usage limit enforcement,
entitlement queries.

Owns: subscriptions, feature_flags.
Provides: ResolveOrganizationEntitlementsService, EnforceFeatureGateService.

Used by: Workshops, Notifications, Reporting, any feature-gated action.

Must not: implement payment processor logic directly (delegated to Stripe via
the Command Center billing integration).

### 5. Workshops

Responsibilities: workshop CRUD, logistics CRUD, public page management,
join code lifecycle, publish/archive transitions.

Owns: workshops, workshop_logistics, public_pages.

Depends on: Organizations, Locations (Scheduling), Subscriptions (plan-gated
workshop creation), Audit.

### 6. Scheduling

Responsibilities: tracks, sessions, locations, capacity enforcement, session
selection, conflict detection, virtual session validation, participant schedule.

Owns: locations, tracks, sessions.
Provides: EnforceSessionCapacityService (SELECT…FOR UPDATE), DetectSelectionConflictService,
ValidateVirtualSessionPublishService.

Depends on: Workshops, Leaders (session assignment), Registrations, Audit.

### 7. Leaders

Responsibilities: leader profile, leader invitations, session assignment,
organisation/workshop/session associations, leader self-service updates.

Owns: leaders, organization_leaders, leader_invitations, workshop_leaders, session_leaders.

Depends on: Identity (user linkage), Organizations, Scheduling (session assignment),
Notifications (invitation email), Audit.

### 8. Registrations

Responsibilities: workshop registration, join-by-code, session selection,
participant schedule assembly.

Owns: registrations, session_selections.

Depends on: Workshops, Scheduling, Subscriptions (participant limits), Audit.

### 9. Attendance

Responsibilities: self check-in, leader check-in, no-show marking, organiser
add/remove participants from sessions, roster assembly, attendance summaries.

Owns: attendance_records.
Provides: SelfCheckInAction, LeaderCheckInAction, MarkNoShowAction,
OrganizerAddParticipantToSessionAction, OrganizerRemoveParticipantFromSessionAction,
BuildSessionRosterService, BuildWorkshopAttendanceSummaryService.

Depends on: Registrations, Scheduling, Leaders (session assignment check), Audit.

Must not: send notifications directly. Route through Notifications module.

### 10. Notifications

Responsibilities: notification creation, recipient resolution, queued delivery,
in-app notification retrieval, push token management, preference management,
leader messaging constraint enforcement.

Owns: notifications, notification_recipients, push_tokens, notification_preferences.
Provides: CreateOrganizerNotificationAction, CreateLeaderNotificationAction,
ResolveNotificationRecipientsService, EnforceLeaderMessagingRulesService,
QueueNotificationDeliveryAction.

Depends on: Organizations, Workshops, Scheduling, Leaders, Registrations/Attendance
(recipient resolution), Subscriptions (plan gate), Audit.

Critical: `custom` delivery_scope throws CustomDeliveryNotImplementedException (501).
Transactional emails are dispatched from their originating module (Auth, Leaders,
Organizations) via Mailable classes — they do not go through this module.

### 11. Offline Sync

Responsibilities: sync package assembly, version hash generation, offline action replay.

Owns: offline_sync_snapshots, offline_action_queue.
Provides: GenerateSyncVersionService, BuildWorkshopSyncPackageService (role-aware),
ReplayOfflineActionsService (idempotent via client_action_uuid).

Depends on: Workshops, Scheduling, Leaders, Registrations, Attendance.

### 12. Files

Responsibilities: S3 presigned URL generation, file confirmation, storage key management.

Owns: files table.
Provides: FileUploadService.

Depends on: Shared Infrastructure (S3 client), Audit.

Rules:
- Presigned URL upload is the only supported upload method in production.
- `POST /api/v1/files/local-upload` is for local development only.
- Files are scoped to organisation where applicable.

### 13. Reporting

Responsibilities: attendance reporting, workshop reporting, usage reporting,
entitlement-aware access.

Owns: No tables (reads from other modules' tables).
Provides: BuildAttendanceReportService, BuildWorkshopReportService, BuildUsageReportService.

Depends on: Subscriptions (plan gate), all domain modules for data.

### 14. Webhooks

Responsibilities: outbound webhook delivery, endpoint management, delivery logging.

Owns: webhook_endpoints, webhook_deliveries.
Provides: WebhookDispatcher, DeliverWebhookJob.

Depends on: Organizations (tenant scoping), Subscriptions (Pro plan required), Audit.

### 15. Enterprise (SSO / API Keys)

Responsibilities: SSO provider configuration, external API key management,
system announcement delivery.

Owns: sso_configurations, api_keys, api_clients, system_announcements.

Depends on: Organizations, Audit.

Rules: SSO is scaffolded only (not production-active). API key auth is active for
the External API layer.

### 16. Audit

Responsibilities: centralised audit event recording, retrieval for admin tooling.

Owns: audit_logs, login_events, security_events.
Provides: AuditLogService::record().

Dependencies: none business-critical; all other modules depend on this one.

Rule: AuditLogService::record() is called from Services and Actions only — never
from Controllers.

### 17. Shared Infrastructure

Responsibilities: base models, queue abstraction, mail abstraction, S3 client,
common response helpers, exception handling, time utilities.

Must not: contain domain business logic.

---

## Platform Service (Command Center)

The Command Center backend is a separate service module under `app/Domain/Platform/`
(or organized as `Api/V1/Platform/` controllers, depending on implementation).

### Platform Auth

Responsibilities: platform admin login/logout, admin session management.

Owns: admin_users, admin_login_events.
Guard: `auth:platform_admin` — completely isolated from `auth:sanctum`.

### Platform Dashboard and Metrics

Responsibilities: aggregate metrics across all tenants, health monitoring.

Owns: metric_snapshots, platform_config.

### Platform Organisation Management

Responsibilities: read/manage tenant organisations, feature flag overrides, plan changes.

Rules:
- May read all tenant data across organisations.
- May only mutate tenant data through explicitly defined platform endpoints.
- Every mutation writes to platform_audit_logs.

### Platform Billing

Responsibilities: Stripe billing integration, invoice management, plan assignment.

Owns: stripe_customers, stripe_subscriptions, stripe_invoices, stripe_events.

Rules: Stripe webhook handler not yet implemented (see OPEN_QUESTIONS.md Q4).

### Platform Automation

Responsibilities: automation rule management and execution.

Owns: automation_rules, automation_runs.

Rules: Automation execution engine not yet implemented (see OPEN_QUESTIONS.md Q8).

### Platform Support

Responsibilities: support ticket management, help article authoring.

Owns: support_tickets, support_ticket_messages, help_articles.

### Platform Audit

Responsibilities: platform admin audit trail.

Owns: platform_audit_logs.
Provides: PlatformAuditService::record().

---

## External API Layer

Third-party integrations access a subset of the Tenant API via API key authentication
(`X-Api-Key` header verified against `api_keys.secret_hash`).

Allowed actions (Pro plan required):
- Read workshop list for the organisation
- Read session list for a workshop
- Read participant count for a workshop

External API routes live under `/api/v1/external/*` and use separate controllers
(`ExternalApiController`). Standard tenant middleware is not applied; the API key
middleware resolves the tenant from the key.

---

## Authorization Enforcement Rules (All Routes)

1. Authentication check — correct guard for the layer (sanctum or platform_admin or API key)
2. Email verification check — where required by route
3. Tenant membership check — user is member of the organisation in context
4. Role check — query database for stored role; never trust client claim
5. Resource ownership check — resource belongs to this organisation
6. Specific business rule check — capacity, time window, plan gate

Never skip steps. Never rely on URL structure as a security boundary. Never trust
client-provided role claims.