# Wayfield – Phase Build Prompts

## Purpose
These prompts are implementation instructions for Claude Code. Submit one phase prompt
at the start of each build phase. They are not brainstorming prompts.

## Constitutional Authority
All prompts defer to: `MASTER_PROMPT.md`
Schema authority: `docs/03_schema/DATA_SCHEMA_FULL.md`
Permissions: `docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md`
Testing: `docs/07_testing/TESTING_AND_VALIDATION_STRATEGY.md`

## Non-Negotiable Constraints (Apply to All Phases)
- Do NOT simplify requirements
- Do NOT substitute single name fields for first_name and last_name
- Do NOT weaken privacy rules
- Do NOT weaken tenant boundaries
- Do NOT move enforcement from backend to UI
- Do NOT omit tests for critical constraints
- Do NOT expose meeting URLs in public endpoints
- Do NOT allow leader messaging outside approved scope and time window
- Capacity null means unlimited — never treat as zero

---

## Phase 0 Prompt – Architecture and Project Setup

You are generating Phase 0 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/05_architecture/TECHNICAL_ARCHITECTURE.md
- docs/05_architecture/MODULE_BOUNDARIES.md
- docs/06_implementation/LARAVEL_IMPLEMENTATION_PLAN.md

Build the foundational project setup for:
- Laravel backend API
- Next.js web app
- Expo mobile app
- Shared environment strategy
- Queue, email, and storage scaffolding
- CI/CD baseline
- Testing baseline
- Module/folder structure

Produce:
- Repository structure and folder conventions matching MODULE_BOUNDARIES.md
- Laravel app folder layout using app/Domain/ module structure
- Environment variable template (.env.example)
- Queue configuration (database driver locally, SQS shape for deployed)
- SES, S3, SQS integration scaffolding notes
- Database connection configuration
- Local development setup instructions
- GitHub Actions CI pipeline outline
- Initial health-check route: GET /health returns 200 + timestamp
- PHPUnit/Pest test suite baseline

Constraints:
- Backend is Laravel (latest stable) with Sanctum
- Database is MySQL
- Storage is S3
- Email is SES
- Queues use SQS or Laravel queue workers
- Architecture must support phased solo-builder execution

Acceptance criteria:
- Laravel app boots locally
- MySQL connection works
- Queue worker runs without error
- Email driver logs locally without sending
- Health route returns 200
- Test suite runs (zero tests, but suite is configured)
- Environment variable template covers all services
- Folder structure matches MODULE_BOUNDARIES.md domains

---

## Phase 1 Prompt – Identity, People, Tenant Foundation, and Auth Extensions

You are generating Phase 1 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/IDENTITY_AND_AUTH.md
- docs/02_domain/PERSON_AND_CONTACT_MODEL.md
- docs/02_domain/MULTI_TENANT_MODEL.md
- docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 1–9)

Build:
- users
- auth_methods
- user_2fa_methods
- user_2fa_recovery_codes
- password_reset_tokens
- user_sessions
- organizations
- organization_users
- subscriptions

Implement:
- Email/password registration
- Email verification flow
- Password reset flow
- Login / logout
- Authenticated profile retrieval (GET /api/v1/me)
- Profile update for first_name / last_name
- Organization creation
- Organization membership model with explicit roles
- Tenant-aware auth scaffolding
- Future-ready social login linkage schema (auth_methods table, inactive)
- Future-ready 2FA schema (tables exist, feature inactive)
- Laravel Sanctum token issuance + user_sessions audit record on login

Produce:
- Migrations for all tables above
- Eloquent models with relationships
- Factories and seeders
- Controllers, Form Request classes, API Resources
- Actions: RegisterUserAction, LoginUserAction, VerifyEmailAction,
  RequestPasswordResetAction, ResetPasswordAction
- Policies: OrganizationPolicy, OrganizationUserPolicy
- API routes per API_ROUTE_SPEC.md Section 1–3
- Tests covering all constraints below

Critical constraints:
- first_name and last_name required on users — DB level AND API validation
- Email/password is primary auth for web and mobile — no exceptions
- Social login schema exists but is inactive; must not break core auth
- Organizations support multiple managers with explicit role distinctions
- organization_users.role: owner, admin, staff, billing_admin
- Tenant data must not leak across organizations
- user_sessions record must be created/updated on every login

Acceptance criteria:
- User can register with first_name, last_name, email, password
- Registration fails without first_name or last_name
- Verification email is queued on registration
- User can verify email via token link
- User can log in; token is issued; user_sessions row is created
- GET /api/v1/me returns first_name and last_name
- User can update first_name and last_name
- Password reset token flow completes end-to-end
- Organization can be created with primary contact fields
- Organization memberships are role-aware
- Tests cover auth flow, tenant boundary, and name field enforcement

---

## Phase 2 Prompt – Workshops, Locations, and Public Pages

You are generating Phase 2 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/WORKSHOP_DOMAIN_MODEL.md
- docs/02_domain/MULTI_TENANT_MODEL.md
- docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 10–12, 27)
- docs/04_api/API_ROUTE_SPEC.md (Sections 3, 6, 7)

Build:
- locations
- workshops
- workshop_logistics
- public_pages
- Join code generation and uniqueness enforcement
- Workshop CRUD
- Workshop status transitions: draft → published → archived
- Public workshop read endpoint

Produce:
- Migrations for locations, workshops, workshop_logistics, public_pages
- Eloquent models with relationships
- Factories
- GenerateJoinCodeService
- Actions: CreateWorkshopAction, UpdateWorkshopAction, PublishWorkshopAction, ArchiveWorkshopAction
- Policies: WorkshopPolicy (tenant + role checks)
- API Resources: OrganizerWorkshopResource, PublicWorkshopResource (strict field separation)
- Organizer admin endpoints per API_ROUTE_SPEC.md Section 6
- Public workshop endpoint per API_ROUTE_SPEC.md Section 7
- Tests

Critical constraints:
- Every workshop belongs to an organization — tenant check on every route
- workshop_type supports session_based and event_based
- join_code must be unique and system-generated
- timezone is required
- public_page_enabled controls public visibility (not public_visibility)
- Public serializer must NEVER expose: private roster data, participant data,
  meeting URLs, private leader contact fields
- Logistics visible in correct contexts:
  - Participant/public: hotel and logistics fields
  - Organizer: full edit access
- Publish validation must enforce all rules defined in WORKSHOP_DOMAIN_MODEL.md

Acceptance criteria:
- Organizer can create, edit, and publish a workshop
- Published workshop is visible on public endpoint
- Draft workshop is not visible on public endpoint
- Public endpoint returns only allowed fields
- Join code is unique and generated automatically
- Logistics can be created and updated
- Archived workshop cannot accept new actions
- Tests cover public/private serialization and tenant boundaries

---

## Phase 3 Prompt – Tracks, Sessions, Selections, Capacity, and Virtual Delivery

You are generating Phase 3 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/SESSION_AND_CAPACITY_MODEL.md
- docs/02_domain/WORKSHOP_DOMAIN_MODEL.md
- docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 13, 18, 20–21)
- docs/04_api/API_ROUTE_SPEC.md (Sections 8–11)

Build:
- tracks
- sessions (with session_leaders junction — no leader_id FK on sessions)
- Session publish validation
- Session selection flow
- Participant schedule retrieval
- Capacity enforcement service (with DB-level locking)
- Overlap/conflict detection service
- meeting_url enforcement for virtual/hybrid sessions

Produce:
- Migrations: tracks, sessions, registrations, session_selections
- Eloquent models with relationships
- Factories
- Services: EnforceSessionCapacityService, DetectSelectionConflictService,
  ValidateVirtualSessionPublishService
- Actions: CreateSessionAction, UpdateSessionAction, PublishSessionAction,
  SelectSessionAction, DeselectSessionAction
- Policies: SessionPolicy, RegistrationPolicy, SessionSelectionPolicy
- API Resources: OrganizerSessionResource, ParticipantSessionResource, PublicSessionResource
- API endpoints per API_ROUTE_SPEC.md Sections 8–11
- Tests

Critical constraints:
- capacity NULL means unlimited — never treat as zero
- Capacity enforcement uses SELECT ... FOR UPDATE or equivalent DB-level locking
- Overlapping session selections must be blocked
- Virtual sessions require meeting_url before is_published can be true
- Hybrid sessions: see OPEN ISSUE in SESSION_AND_CAPACITY_MODEL.md regarding
  virtual_participation_allowed flag — document the interim approach taken
- meeting_url must NEVER appear in public session endpoints
- Session time fields are start_at / end_at (DATETIME) — not start_time / end_time
- Sessions have no leader_id FK; leader assignment is via session_leaders table
- Event-based workshop check-in must work without a session_selections row
  (registration alone is sufficient eligibility)

Acceptance criteria:
- Participant can select a session with available capacity
- Capacity-full selection is rejected at the API layer
- Overlapping session selection is rejected
- Null capacity behaves as unlimited
- Virtual/hybrid session cannot be published without meeting_url
- meeting_url does not appear in any public response
- Participant schedule endpoint returns correct selections
- Tests cover capacity enforcement, conflict detection, and virtual rules
- Tests explicitly cover concurrent selection race condition

---

## Phase 4 Prompt – Leaders, Invitations, and Self-Managed Profiles

You are generating Phase 4 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/LEADER_SYSTEM.md
- docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 14–17, 19)
- docs/04_api/API_ROUTE_SPEC.md (Sections 12–14)

Build:
- leaders
- organization_leaders
- leader_invitations
- workshop_leaders
- session_leaders
- Invitation send, accept, decline flow
- Leader-owned profile completion and editing
- Public leader serialization

Produce:
- Migrations for all tables above
- Eloquent models with relationships
- Factories
- Actions: InviteLeaderAction, AcceptLeaderInvitationAction,
  DeclineLeaderInvitationAction, UpdateLeaderProfileAction,
  AttachLeaderToSessionAction
- Policies: LeaderPolicy, LeaderInvitationPolicy
- API Resources: OrganizerLeaderResource, PublicLeaderResource, LeaderSelfProfileResource
- Email template: leader invitation email (queued)
- API endpoints per API_ROUTE_SPEC.md Sections 12–14
- Tests

Critical constraints:
- Invitation token stored as invitation_token_hash (hashed); raw token in email only
- session_id is NOT a field on leader_invitations
- Session assignment happens post-acceptance via session_leaders (separate action)
- Leader profile is owned by the leader — organizers must NOT be required to populate it
- Leaders are global entities reusable across organizations
- Only leaders with status = 'accepted' and is_confirmed = true appear publicly
- Public leader serializer exposes ONLY: first_name, last_name, display_name,
  profile_image_url, bio, website_url, city, state_or_region
- Full address (address_line_1, postal_code, country) must NEVER appear publicly
- Leaders must not gain access to sessions or rosters until session_leaders assignment
- Organizer must be able to create a placeholder leader record without bio/personal details

Acceptance criteria:
- Organizer can invite a leader by email
- Leader receives invitation email with tokenized link
- Leader can accept invitation and complete profile
- Leader can decline invitation
- Expired invitation is rejected
- Leader can edit their own profile after acceptance
- Accepted leader appears on workshop page (confirmed public leaders only)
- Unaccepted leader does not appear publicly
- Public resource never exposes private address or contact fields
- Tests cover invitation lifecycle, privacy serialization, and profile ownership

---

## Phase 5 Prompt – Attendance, Roster Operations, and Leader Messaging

You are generating Phase 5 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/ATTENDANCE_AND_ROSTER_SYSTEM.md
- docs/02_domain/NOTIFICATIONS_AND_MESSAGING_SYSTEM.md
- docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
- docs/02_domain/LEADER_SYSTEM.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 18–22, 24–25, 32)
- docs/04_api/API_ROUTE_SPEC.md (Sections 15–16)
- docs/07_testing/TESTING_AND_VALIDATION_STRATEGY.md

Build:
- attendance_records (registrations and session_selections already built in Phase 3)
- Participant self-check-in
- Leader manual check-in
- No-show marking
- Leader attendance override
- Roster endpoints with phone number privacy enforcement
- Leader notification composer with hard scope and time-window enforcement
- Audit logging for all attendance mutations and leader notifications

Produce:
- Migration: attendance_records
- Eloquent models
- Factories
- Services: SelfCheckInAction, LeaderCheckInAction, MarkNoShowAction,
  BuildSessionRosterService, BuildWorkshopAttendanceSummaryService,
  EnforceLeaderMessagingRulesService
- Policies: AttendancePolicy, RosterPolicy, NotificationPolicy (leader scope)
- API Resources: RosterParticipantResource (with phone visibility rule),
  AttendanceSummaryResource
- API endpoints per API_ROUTE_SPEC.md Section 15
- Leader notification creation endpoint with full constraint enforcement
- Audit logging integration for all actions below
- Tests — see acceptance criteria

Critical constraints:
- Participant must be registered before self-check-in is allowed
- Session selection eligibility: required for session_based workshops;
  registration alone is sufficient for event_based workshops
- Leader may only operate on sessions they are explicitly assigned to (session_leaders)
- Unassigned leader attempting roster access or attendance action must receive 403
- Phone numbers in RosterParticipantResource: visible only to assigned leaders
  and org owner/admin/staff — never to participants or unrelated leaders
- Leader messaging:
  - session_id is REQUIRED on all leader-created notifications
  - leader must be in session_leaders for that session
  - time window must be computed in the workshop's timezone:
    window_start = session.start_at (in workshop timezone) minus 4 hours
    window_end = session.end_at (in workshop timezone) plus 2 hours
  - recipients must be resolved from session participants only
  - backend validation is MANDATORY before any message is queued
- ALL leader notifications must produce an audit_logs record with:
  leader_id, session_id, workshop_id, organization_id, recipient_count, sent_at
- Attendance status transitions: not_checked_in → checked_in, not_checked_in → no_show

Acceptance criteria:
- Registered participant can self-check in
- Unregistered participant self-check-in is rejected
- Leader assigned to session can mark check-in and no-show
- Leader NOT assigned to session receives 403 on any attendance or roster action
- Organizer sees aggregate attendance summary across all sessions
- Participant cannot access any roster endpoint
- Phone numbers appear in roster only for authorized roles
- Leader notification without session_id is rejected
- Leader notification where leader is not assigned to session is rejected
- Leader notification outside time window is rejected
- Leader notification within window is accepted and produces audit_log record
- Time window tests use fixtures with explicit non-UTC workshop timezones
- Tests cover all rejection paths, not just happy paths

---

## Phase 6 Prompt – Notifications, Transactional Email, Preferences, and Auth Hardening

You are generating Phase 6 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/NOTIFICATIONS_AND_MESSAGING_SYSTEM.md
- docs/02_domain/IDENTITY_AND_AUTH.md
- docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 23–26)
- docs/04_api/API_ROUTE_SPEC.md (Sections 16–18)

Build:
- notifications
- notification_recipients
- push_tokens
- notification_preferences
- Queued email delivery jobs
- Queued push delivery jobs
- In-app notification retrieval
- User preference endpoints
- Auth hardening scaffolding for future 2FA activation

Produce:
- Migrations: notifications, notification_recipients, push_tokens, notification_preferences
- Eloquent models and relationships
- Services: CreateNotificationAction, ResolveNotificationRecipientsService,
  QueueNotificationDeliveryAction, SendEmailNotificationJob, SendPushNotificationJob
- API endpoints per API_ROUTE_SPEC.md Sections 16–18
- Transactional email templates:
  - Email verification
  - Password reset
  - Leader invitation
  - Workshop join confirmation
  - Workshop change notification
- Tests

Critical constraints:
- Organizer notifications may target: all_participants, leaders, session_participants
- Leader notifications remain fully constrained per Phase 5 rules
- delivery_scope = 'custom' must be acknowledged as an unimplemented enum value —
  document it as a placeholder; do not implement partially
- Recipient resolution must be explicit and auditable
- notification_preferences must not suppress critical transactional emails
  (verification, reset, invitation)
- push_tokens registered per device per platform — one token may be replaced on re-register
- Auth hardening: user_2fa_methods and user_2fa_recovery_codes tables exist (from Phase 1)
  — add scaffolding to enable activation in a future phase without schema changes

Acceptance criteria:
- Organizer can create a notification targeting all participants
- Notification recipients are correctly resolved and stored in notification_recipients
- Email delivery job is queued (not sent synchronously)
- Push delivery job is queued per active push_token
- In-app notifications are retrievable via GET /api/v1/me/notifications
- Unread notifications can be marked as read
- Push tokens can be registered and deactivated
- User preferences can be retrieved and updated
- Leader notifications remain constrained per Phase 5 rules
- Tests cover recipient scoping, queued delivery, and preference handling

---

## Phase 7 Prompt – Offline Sync and Mobile Resilience

You are generating Phase 7 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/OFFLINE_SYNC_STRATEGY.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 29–30)
- docs/04_api/API_ROUTE_SPEC.md (Section 19)

Build:
- Workshop sync payload endpoints
- Sync versioning support
- Offline snapshot generation
- Offline action replay support (self-check-in, leader check-in)
- Idempotent attendance reconciliation

Produce:
- Migrations: offline_sync_snapshots, offline_action_queue
- Services: BuildWorkshopSyncPackageService, GenerateSyncVersionService,
  ReplayOfflineActionsService
- API endpoints per API_ROUTE_SPEC.md Section 19
- Mobile sync contract documentation (what fields are included/excluded)
- Tests

Critical constraints:
- Workshop overview, session schedule, logistics, and leader info available offline
- Meeting URLs must NOT be included in the sync package (privacy — public package risk)
- Participant phone numbers must NOT be included in participant-facing sync package
- Leader-facing sync package may include phone numbers only for their assigned sessions
- Offline check-in actions must replay safely when online resumes
- Duplicate attendance records must NOT be created on replay
- Idempotency enforced via client_action_uuid (UNIQUE constraint on offline_action_queue)
- Sync version hash allows mobile to detect stale package without full download

Acceptance criteria:
- Mobile client can fetch sync package for a workshop
- Sync package does not contain meeting_url or private participant phone numbers
- Leader sync package contains phone numbers for assigned session participants only
- Offline check-in action can be queued locally and replayed
- Replaying the same client_action_uuid twice produces no duplicate attendance row
- Sync version endpoint returns a hash that changes when workshop data changes
- Tests cover replay idempotency and privacy constraints on package contents

---

## Phase 8 Prompt – Reporting, Feature Gating, and Plan Enforcement

You are generating Phase 8 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/02_domain/SUBSCRIPTION_AND_FEATURE_GATING.md
- docs/01_product/PRICING_AND_TIERS.md
- docs/03_schema/DATA_SCHEMA_FULL.md (Tables 9, 31)
- docs/04_api/API_ROUTE_SPEC.md (Sections 4, 20)

Build:
- Plan entitlement resolution service
- Feature gating middleware and service
- Usage counting for plan limits
- Workshop and attendance summary reporting
- Reporting endpoints

Produce:
- Services: ResolveOrganizationEntitlementsService, EnforceFeatureGateService,
  BuildAttendanceReportService, BuildUsageReportService
- Middleware: feature gate enforcement on gated routes
- API endpoints per API_ROUTE_SPEC.md Sections 4 and 20
- Tests

Critical constraints:
- Plan enforcement is backend-only — never rely on UI gating alone
- Free plan limits: 1 organizer, 2 active workshops, 75 participants per workshop
- Starter plan limits: 5 managers, 10 active workshops, 250 participants per workshop
- Leader messaging constraints ALWAYS apply regardless of plan
- feature_flags table supports plan-derived and manual_override values
- Manual override process: define who can set overrides and require audit log entry
- Reporting endpoints are tenant-scoped — organization_id required

Acceptance criteria:
- Free plan organization is blocked from creating a 3rd active workshop
- Starter plan organization is blocked from 11th active workshop
- Blocked features return a clear error response (not a 500)
- Entitlements endpoint returns current plan's feature set
- Attendance report returns correct tenant-scoped data
- Plan enforcement cannot be bypassed by a UI-only workaround
- Tests cover plan boundaries and manual override audit logging

---

## Phase 9 Prompt – Enterprise Readiness and Future Extensions

You are generating Phase 9 of Wayfield.

Reference documents:
- MASTER_PROMPT.md (constitutional authority)
- docs/05_architecture/TECHNICAL_ARCHITECTURE.md
- docs/02_domain/IDENTITY_AND_AUTH.md
- docs/02_domain/MULTI_TENANT_MODEL.md

Build planning-safe extension points for:
- SSO (SAML / OIDC)
- Governance controls (audit trail improvements, data retention policies)
- Webhooks (outbound event delivery)
- External API access (public API keys, rate limiting)
- Workshop discovery and search readiness

Produce:
- Architecture notes and service contracts for each extension area
- Interface boundaries that do not require schema rewrites
- Webhook event payload contracts (structure only, no delivery implementation)
- API key scaffolding (schema + issuance endpoint if appropriate)
- Tests where implementation exists

Critical constraints:
- SSO must not break core email/password account model (additive, not replacement)
- Tenant safety must be preserved in all extension points
- Role and privacy rules must not be weakened by any extension
- Discovery features must not expose private data publicly

Acceptance criteria:
- Clear extension points exist for SSO without major schema changes
- Webhook event structure is defined for key domain events
- API key schema exists and issuance works if implemented
- No existing authorization or privacy behavior is regressed
