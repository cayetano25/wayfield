# Wayfield — Claude Code Project Memory

Wayfield is a production-bound, multi-tenant SaaS platform for managing photography
workshops and creative events. Laravel API backend · MySQL · Expo/React Native mobile ·
Next.js web admin · AWS infrastructure.

> Constitutional authority: @MASTER_PROMPT.md
> Role authority: @docs/02_domain/ROLE_MODEL.md
> Conflict resolution hierarchy: README.md Section 3
> Phase status: @docs/06_implementation/PHASE_STATUS.md

---

## Tech Stack

| Layer          | Technology                               |
|----------------|------------------------------------------|
| Backend API    | Laravel (latest stable)                  |
| Auth tokens    | Laravel Sanctum                          |
| Database       | MySQL (AWS RDS)                          |
| Mobile         | Expo / React Native (offline-first)      |
| Web Admin      | Next.js (`web/`)                         |
| Command Center | Next.js (`command/`) — scaffolded only   |
| Email          | AWS SES                                  |
| Queues         | AWS SQS / Laravel queue workers          |
| File storage   | AWS S3                                   |
| CDN            | CloudFront                               |
| Push           | Firebase Cloud Messaging / Expo Push     |
| Monitoring     | CloudWatch + Sentry                      |
| CI/CD          | GitHub Actions                           |

---

## Non-Negotiable Rules

### Unified User Account Model

One `users` record, all roles, context-determined. This is constitutional.

- A person is **never** a separate account type per role. A single email address and
  password gives access to every context that person holds.
- Role is **never** stored on the `users` table. It is derived from relationships:
  - **Participant** — derived from a `registrations` row for the workshop in context
  - **Leader** — derived from `leaders.user_id` + accepted `leader_invitations` + `session_leaders` assignment
  - **Organization member** — derived from `organization_users.role` for the org in context
- The same account may simultaneously be a participant in one org's workshop, a leader
  in another, and an admin of a third organisation. All three contexts are resolved
  per-request, per-resource.
- See @docs/02_domain/UNIFIED_USER_ACCOUNT.md for the full model, transition scenarios,
  and organisation invitation process.

### Identity and People
- `first_name` and `last_name` are REQUIRED on every real-person entity. Never use a
  single `name` field.
- Primary auth is email + password across web and mobile. No exceptions.
- Social login (Google, Facebook) is additive schema scaffolding only — it never
  replaces core email/password auth. Schema exists; feature is not active.
- 2FA schema (`user_2fa_methods`, `user_2fa_recovery_codes`) must exist and be
  schema-ready even if not yet activated. `TwoFactorController` endpoints return 501.
- Auth tokens: Laravel Sanctum (`personal_access_tokens`).
- `user_sessions` table tracks multi-device audit metadata alongside Sanctum tokens
  (separate purpose — see DEC-004 in @docs/stabilization/DECISIONS.md).
- Column name is `password_hash`, not Laravel's default `password`. The `User` model
  overrides `getAuthPassword()` and `getAuthPasswordName()` accordingly.

### Two Identity Systems — Never Mix
- **Tenant system**: `users` table · `auth:sanctum` guard · routes under `/api/v1/*`
- **Platform system**: `admin_users` table · `auth:platform_admin` guard · routes under `/api/platform/v1/*`
- A tenant token **must** be rejected on platform routes. A platform token **must** be
  rejected on tenant routes. Enforced by middleware on every route — never by convention.

### Multi-Tenancy
- Every protected resource must be scoped by `organization_id`.
- Cross-tenant data leakage is a critical failure. Enforce in DB queries, policies,
  and API middleware — never UI alone.

### Role Mapping — Conceptual to DB
"Organizer" is a conceptual term. It is **never** a stored DB value.
Canonical authority: @docs/02_domain/ROLE_MODEL.md

| Conceptual term | `organization_users.role` value(s) | Notes |
|---|---|---|
| Full organizer / admin | `owner`, `admin` | Full workshop, leader, participant management |
| Staff organizer | `staff` | Workshop view, attendance, roster (incl. phone numbers); no billing, no leader invitations, no org-wide notifications |
| Billing admin | `billing_admin` | Billing portal only; **no** workshop or participant access |
| Leader | (not in org_users) | Derived from `leaders.user_id` + invitations + session_leaders |
| Participant | (not in org_users) | Derived from `registrations` |

Policy classes must check stored `role` values (`IN ('owner', 'admin')` etc.), never
conceptual terms. Always document which stored roles a policy allows.

### Capacity
- `capacity = NULL` means **unlimited**. NEVER treat null as zero.
- When capacity is set, enforce it in backend business logic with database-level
  locking (`SELECT … FOR UPDATE`). Never UI alone.
- Race conditions on simultaneous session selection must be handled at the DB layer.

### Virtual Sessions
- `delivery_type = 'virtual'` requires `meeting_url` before a session can be published.
- `delivery_type = 'hybrid'` with `virtual_participation_allowed = true` also requires
  `meeting_url` before publishing.
- Meeting URLs are **never** returned in fully public workshop endpoints.
- Meeting URLs are **never** included in the offline sync package.
- Participant-facing interfaces must show a "Join Meeting" action for virtual/hybrid sessions.

### Leader Permissions
- Leaders may **only** access rosters for sessions they are explicitly assigned to via
  `session_leaders`.
- Leaders may **only** message participants in their assigned sessions.
- Messaging time window: 4 hours before `session.start_at` through 2 hours after
  `session.end_at`. All window calculations use the **parent workshop's timezone**, not UTC.
- Backend enforcement of messaging scope and window is **mandatory**. UI is supplementary.
- All leader notifications must produce an `audit_logs` record regardless of outcome.
- Leader-to-participant notifications require **Starter plan or higher**. Free plan
  returns HTTP 403 with `{ "error": "plan_required", "required_plan": "starter" }`.

### Privacy
- Participant phone numbers: visible **only** to assigned leaders for their session,
  and to org members with role `owner`, `admin`, or `staff`.
- Leader full address (`address_line_1`, `address_line_2`, `postal_code`, `country`):
  private. Public APIs expose only `city` and `state_or_region`.
- Active meeting links: **never** in public workshop endpoints by default.
- Active meeting links: **never** in the offline sync package.

### Feature Gating
- Enforce plan limits at the API/backend layer. Never UI alone.
- `EnforceFeatureGateService` is the single enforcement point for plan limits.
- See @docs/01_product/PRICING_AND_TIERS.md for plan-to-feature mapping.

### Serialization
- Use role-aware API Resource classes. Never one universal serializer for all audiences.
- Public, Organizer, Participant, Leader, and Self resource classes are separate.

### Audit Logging
- `AuditLogService::record()` must be called for: leader notifications, attendance
  overrides, workshop publish/archive, manual feature flag overrides, all auth events,
  all organisation user management events (invite, accept, role change, remove,
  ownership transfer).
- Call from Services and Actions only — never from Controllers.

---

## Laravel Conventions
- Thin controllers: validate → authorize → dispatch service/action → return resource.
- Business logic lives in Action or Service classes under `app/Domain/`.
- Authorization via Policies. Never rely on route visibility alone.
- Form Request classes for all input validation.
- Queue all notification delivery (email, push, in-app). Never synchronous.
- `AuditLogService::record()` called from services, not controllers.
- Transactional emails (verification, reset, leader invitation, org member invitation)
  are sent via dedicated Mailable classes and bypass `notification_preferences` checks.
- `delivery_scope = 'custom'` throws `CustomDeliveryNotImplementedException` (HTTP 501)
  — this is an intentional placeholder. Do not implement partially.

---

## Current Build Phase

API Backend:       Phase 9 complete
(Auth, Orgs, Workshops, Sessions, Leaders, Attendance,
Notifications, Offline Sync, Feature Gating, Enterprise scaffolding)
CC API Backend:    Complete
(platform admin auth, Stripe schema, automation rules,
support tickets, metrics endpoints)
Web / Improvement: Phase 14 complete — Add Participants to Sessions
(all web phases 1–9 and improvement phases 10–14 are done)
NOT STARTED — do not describe these as complete:
Phase 15:        Dashboard Analytics (plan-aware metrics, locked cards)
Phase 16:        International Address System — ✅ DONE (API phase complete)
Audit Remediation: 10 items identified, none implemented
CC Frontend:     command/ scaffolded only (layout.tsx + page.tsx)
Mobile:          mobile/ scaffolded only (no domain screens)

See @docs/06_implementation/PHASE_STATUS.md for the full phase history, completion
status per phase, and the audit remediation checklist.

Use prompts from @docs/06_implementation/PHASE_PROMPTS.md to start each phase.

---

## Key Implementation Decisions (Quick Reference)

Full log: @docs/stabilization/DECISIONS.md

| # | Decision |
|---|---|
| DEC-004 | Column is `password_hash`, not `password`; User model overrides auth password methods |
| DEC-005 | Custom `password_reset_tokens` table with `token_hash` + `expires_at` |
| DEC-010 | `capacity = NULL` is unlimited — never zero |
| DEC-011 | Capacity enforced with `SELECT … FOR UPDATE` |
| DEC-012 | No `leader_id` FK on sessions; use `session_leaders` junction table |
| DEC-013 | Invitation tokens stored hashed; raw token in email only |
| DEC-014 | No `session_id` on `leader_invitations`; session assignment is post-acceptance |
| DEC-015 | Transactional emails bypass `notification_preferences` |
| DEC-016 | `custom` delivery_scope throws 501 — intentional placeholder |
| DEC-017 | Leader messaging window computed in workshop timezone, not UTC |
| DEC-018 | Role-aware Resource classes; no universal serializer |
| DEC-021 | Meeting URLs never included in offline sync package |
| DEC-023 | Stripe tables mirror Stripe data locally; webhook handler not yet wired |
| DEC-026 | Unified user account model — one account, all roles, context-determined |
| DEC-027 | `organisation_invitations` table required for org user management flow |

---

## Directory Map
CLAUDE.md                            ← This file (project memory for root context)
MASTER_PROMPT.md                     ← Constitutional source of truth
README.md                            ← Documentation index and authority hierarchy
api/                                 ← Laravel backend API
CLAUDE.md                          ← Laravel-specific conventions
app/
Domain/                          ← Actions, Services, domain logic (17 modules)
Http/
Controllers/
Requests/
Resources/
Policies/
routes/
database/
migrations/
factories/
seeders/
tests/
web/                                 ← Next.js web admin + public pages
CLAUDE.md                          ← Next.js-specific conventions
command/                             ← Next.js Command Center (scaffolded only)
CLAUDE.md                          ← Command Center-specific conventions
mobile/                              ← Expo React Native (scaffolded only)
CLAUDE.md                          ← Mobile-specific conventions
docs/
01_product/
MVP_SCOPE.md                     ← Product MVP scope and phase roadmap
PRICING_AND_TIERS.md             ← Plan tiers and feature entitlements (authority)
02_domain/                         ← What the system must do
IDENTITY_AND_AUTH.md             ← Auth spec, Sanctum, user_sessions coexistence
PERSON_AND_CONTACT_MODEL.md      ← first_name/last_name rules for all people
MULTI_TENANT_MODEL.md            ← Tenant isolation rules
ROLE_MODEL.md                    ← CANONICAL role taxonomy (supersedes permissions_matrix.md)
PERMISSIONS_AND_PRIVACY_MODEL.md ← Full permission matrix and privacy rules
UNIFIED_USER_ACCOUNT.md          ← One account for all roles; org user management
WORKSHOP_DOMAIN_MODEL.md
SESSION_AND_CAPACITY_MODEL.md
LEADER_SYSTEM.md
ATTENDANCE_AND_ROSTER_SYSTEM.md
NOTIFICATIONS_AND_MESSAGING_SYSTEM.md
SUBSCRIPTION_AND_FEATURE_GATING.md
OFFLINE_SYNC_STRATEGY.md
03_schema/
DATA_SCHEMA_FULL.md              ← Canonical schema; field names override domain files
04_api/
API_AND_SERVICE_BOUNDARIES.md
API_ROUTE_SPEC.md                ← Complete HTTP API surface
05_architecture/
TECHNICAL_ARCHITECTURE.md
MODULE_BOUNDARIES.md             ← Laravel module structure (17 modules)
06_implementation/
LARAVEL_IMPLEMENTATION_PLAN.md
PHASED_IMPLEMENTATION_PLAN.md    ← API Phases 0–9 scope detail
PHASE_STATUS.md                  ← CANONICAL progress tracker (replaces BUILD_SEQUENCE_CHECKLIST.md)
WEB_PHASE_PLAN.md                ← Web phases 1–14 scope and status
PHASE_PROMPTS.md                 ← Claude Code prompts for all phases
UNIFIED_USER_ACCOUNT_PLAN.md     ← Phased impl guide for unified account model
07_testing/
TESTING_AND_VALIDATION_STRATEGY.md
OFFLINE_SYNC_CONTRACT.md
command_center/
COMMAND_CENTER_OVERVIEW.md
COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
COMMAND_CENTER_SCHEMA.md
NAVIGATION_SPEC.md
stabilization/                     ← Audit snapshots and living decision log
DECISIONS.md                     ← Decision log — update every phase
OPEN_QUESTIONS.md                ← Unresolved questions — review every phase
CURRENT_STATE_IMPLEMENTED.md     ← Audit snapshot 2026-04-06
CURRENT_STATE_INTENDED.md        ← Audit snapshot 2026-04-06
DRIFT_REPORT.md                  ← Gap analysis 2026-04-06
WAYFIELD_TIMELINE.md             ← Build chronology
DOCUMENTATION_RESTRUCTURE_PLAN.md
deprecated/                        ← Retired files — do not use; kept for traceability
IDENTITY_SYSTEM.md
BUILD_SEQUENCE_CHECKLIST.md
permissions_matrix.md
PLAN.md
SCHEMA_SPEC.md
TECH_STACK_AWS.md
mvp_and_phases.md
pricing.md
aws_foundation_plan.md
UserAccounts.md

---

## Phase End Checklist

At the end of every phase, complete all five items before marking the phase done:

1. **PHASE_STATUS.md** — mark phase complete; add implementation notes and any deviations
2. **CLAUDE.md** — update "Current Build Phase" block
3. **DECISIONS.md** — add any non-obvious decisions made during the phase
4. **OPEN_QUESTIONS.md** — close resolved questions; add new ones
5. **Schema/API docs** — update `DATA_SCHEMA_FULL.md` if migrations changed;
   update `API_ROUTE_SPEC.md` if routes changed

Tests must be passing before a phase is considered complete.