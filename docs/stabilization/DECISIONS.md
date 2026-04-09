# Wayfield — Major Decisions Log
## docs/stabilization/DECISIONS.md

> **Update process:** Add a new entry whenever a non-obvious design or
> implementation decision is made. Review at the end of every phase.
> Rationale and impact must be explicit.
>
> Format: Decision → Rationale → Impact → Status
>
> Last updated: 2026-04-08 (Phase 16 — DEC-032 through DEC-034 added)

---

## Architecture

---

### DEC-001: Documentation-First Development with Claude Code

**Decision:** All specification documents were written before any implementation
began. Claude Code is used to generate implementation from these specs phase by phase.

**Rationale:** Solo-builder context. Documentation-first ensures the AI has a
complete, authoritative spec to work from without conversational drift. Phase prompts
act as reproducible generation instructions.

**Impact:** Docs become stale when implementation expands. Requires periodic
stabilisation. The 2026-04-06 audit documents the first stabilisation round.

**Status:** Active.

---

### DEC-002: Monorepo with Four Apps

**Decision:** All Wayfield apps live in a single repository: `api/` (Laravel),
`web/` (Next.js organiser admin), `mobile/` (Expo), `command/` (Next.js Command Center).

**Rationale:** Shared context for solo builder; easier cross-app coordination;
simpler Claude Code session continuity.

**Status:** Active.

---

### DEC-003: Constitutional Authority Hierarchy

**Decision:** When documents conflict, a strict authority hierarchy applies:
1. `MASTER_PROMPT.md` — overrides everything
2. `docs/01_product/` — product scope and pricing
3. `docs/03_schema/DATA_SCHEMA_FULL.md` — schema field names override domain files on naming conflicts
4. `docs/02_domain/` — domain behaviour and business rules
5. `docs/05_architecture/` + `docs/06_implementation/` — architectural patterns and tactics

**Rationale:** Multiple documents covering the same ground will inevitably conflict.
A defined resolution order prevents ambiguity in AI-generated code.

**Status:** Active. Documented in `README.md` Section 3.

---

## Identity and Auth

---

### DEC-004: `password_hash` Column (Not `password`)

**Decision:** The `users` table uses `password_hash` as the column name instead of
Laravel's default `password`. The `User` model overrides `getAuthPassword()` and
`getAuthPasswordName()`.

**Rationale:** Explicit naming makes the stored value's purpose clear and aligns with
`DATA_SCHEMA_FULL.md` naming conventions.

**Impact:** Any Laravel package assuming the `password` column by default will break.
This override must be maintained on the User model permanently.

**Status:** Active.

---

### DEC-005: Custom `password_reset_tokens` Table

**Decision:** A custom `password_reset_tokens` table with `token_hash` and `expires_at`
instead of Laravel's default table structure.

**Rationale:** Stores a hashed token, never plaintext. Aligns with the security
principle of never storing raw secrets.

**Impact:** Laravel's built-in password broker cannot be used without customisation.
The reset flow is fully custom (`RequestPasswordResetAction`, `ResetPasswordAction`).

**Status:** Active.

---

### DEC-006: Social Login Schema Ready; Feature Not Active

**Decision:** `auth_methods` table supports `google`, `facebook`, `sso_provider`
provider values. Schema exists. Active Google/Facebook login is not wired.
Phase 9 added SSO scaffolding (`SsoController`, `SsoAuthService`) but it is not
production-ready.

**Rationale:** `MASTER_PROMPT.md` requires social login as "additive schema scaffolding
— never replaces core auth." Build the schema now; implement later.

**Impact:** Future social login requires controller wiring but no schema changes.

**Status:** Schema active, feature inactive. Active implementation is Phase 3 product scope.

---

### DEC-007: 2FA Schema Ready; Feature Returns 501

**Decision:** `user_2fa_methods` and `user_2fa_recovery_codes` tables exist.
`TwoFactorController` exists with all expected endpoints returning 501 Not Implemented.

**Rationale:** `MASTER_PROMPT.md` requires 2FA tables to "exist and be schema-ready
even if not yet activated."

**Impact:** Activating 2FA requires no schema changes. Only `TwoFactorController`
methods need implementation.

**Status:** Schema active, feature returns 501.

---

### DEC-026: Unified User Account Model (Added 2026-04-06)

**Decision:** One `users` record serves all roles simultaneously. Role is never stored
on the `users` table. Participant status derives from `registrations`. Leader status
derives from `leaders.user_id` + accepted `leader_invitations` + `session_leaders`
assignment. Organisation member status derives from `organization_users.role`.
No separate account types exist for any role.

**Rationale:** A person should use one email address and one password regardless of
how many roles they hold across organisations and workshops. Separate account types
create fragmented identity, duplicate data, and poor user experience. The relationship
model is the correct place to model role contexts.

**Impact:** Every API endpoint that checks permissions must resolve role from
relationships, never from a field on `users`. Cross-role scenarios (same user is
participant + admin) must be explicitly tested.

**Status:** Active. Canonical reference: `docs/02_domain/UNIFIED_USER_ACCOUNT.md`.

---

### DEC-027: `organization_invitations` Table Required

**Decision:** A separate `organization_invitations` table is required to support the
organisation user management process (inviting people to manage an organisation as
`admin`, `staff`, or `billing_admin`). This is distinct from `leader_invitations`.
Identified as a gap in the 2026-04-06 audit.

**Rationale:** The organisation user management process is defined in `ROLE_MODEL.md`
and `UNIFIED_USER_ACCOUNT.md` but no schema or API implementation existed.

**Impact:** Requires: new migration, new model, new controller, new policy, new
`OrgMemberInvitationMail`, new web admin UI. See `UNIFIED_USER_ACCOUNT_PLAN.md`.

**Status:** Defined in schema, not yet implemented in migrations or code.

---

## Multi-Tenancy

---

### DEC-008: Every Protected Resource Scoped by `organization_id`

**Decision:** All domain resources (workshops, sessions, leaders, notifications, etc.)
have `organization_id`. All policies and queries enforce tenant-scoped access.

**Rationale:** `MASTER_PROMPT.md` treats cross-tenant leakage as a "critical failure."

**Status:** Active, non-negotiable.

---

### DEC-009: Platform Admin Auth Is Completely Isolated From Tenant Auth

**Decision:** The Command Center uses a separate `platform_admin` Sanctum guard backed
by the `admin_users` table. Platform routes (`/api/platform/v1`) reject tenant tokens.
Tenant routes (`/api/v1`) reject platform admin tokens.

**Rationale:** Complete isolation prevents privilege escalation from tenant access to
platform-level access.

**Impact:** Two separate login flows, two token stores, two middleware groups. No shared
session between the systems.

**Status:** Active.

---

## Sessions and Capacity

---

### DEC-010: `capacity = NULL` Means Unlimited

**Decision:** Null capacity is unlimited. `EnforceSessionCapacityService` skips
enforcement entirely when capacity is null.

**Rationale:** `MASTER_PROMPT.md` states this explicitly. Many systems default null to
zero; Wayfield inverts this to avoid accidentally blocking enrolment.

**Impact:** All capacity checks must guard on `is_null($session->capacity)` before
comparing. Null must never be treated as zero anywhere in the codebase.

**Status:** Active, non-negotiable.

---

### DEC-011: Capacity Enforcement Uses SELECT…FOR UPDATE

**Decision:** `EnforceSessionCapacityService` uses database-level locking
(`lockForUpdate()`) when checking enrolment counts.

**Rationale:** `MASTER_PROMPT.md` explicitly requires DB-layer race condition handling.
UI-only or optimistic-lock approaches are insufficient.

**Impact:** Requires transactions around capacity checks and enrolment inserts.

**Status:** Active.

---

### DEC-012: Sessions Have No `leader_id` FK; Leaders Are in `session_leaders`

**Decision:** Sessions have no direct leader foreign key. Leader-to-session relationships
are managed through the `session_leaders` junction table.

**Rationale:** A session can have multiple leaders, each with a `role_label` and
`assignment_status` lifecycle. None of this is possible with a simple `leader_id` FK.

**Impact:** All queries needing session leaders must JOIN through `session_leaders`.
Leader check-in eligibility checks `session_leaders.assignment_status`, not a session field.

**Status:** Active.

---

### DEC-030: `virtual_participation_allowed` Field Resolves Hybrid Session Ambiguity (Added 2026-04-06)

**Decision:** The `sessions` table has a `virtual_participation_allowed` BOOLEAN field
(default false). For `delivery_type = 'hybrid'` sessions, this field determines whether
`meeting_url` is required before publishing. If `virtual_participation_allowed = true`,
`meeting_url` is required. If false, no meeting URL is needed.

**Rationale:** Earlier documentation listed this as an open design question. The field
is implemented in the schema. This decision closes that open question and provides the
definitive rule.

**Impact:** `ValidateVirtualSessionPublishService` checks this field when `delivery_type = 'hybrid'`.
The session create/edit form must expose this toggle. `SESSION_AND_CAPACITY_MODEL.md`
updated to reflect this as resolved.

**Status:** Active. Field exists in schema.

---

## Leaders

---

### DEC-013: Invitation Tokens Stored Hashed; Raw Token in Email Only

**Decision:** Both `leader_invitations.invitation_token_hash` and
`organization_invitations.invitation_token_hash` store hashed tokens. The raw token
is generated at creation time, included in the invitation email link, and never stored.

**Rationale:** If the database is compromised, invitation tokens cannot be replayed.
Standard security pattern for invitation and reset token storage.

**Impact:** Token verification hashes the incoming token and compares to stored hash.

**Status:** Active. Applies to both leader and organisation member invitations.

---

### DEC-014: No `session_id` on `leader_invitations`

**Decision:** The `leader_invitations` table has no `session_id` column. Session
assignment is a separate post-acceptance action via `AttachLeaderToSessionAction`
creating a `session_leaders` row.

**Rationale:** Inviting a leader is about organisation or workshop participation.
Session assignment is an operational decision made after acceptance. Conflating the
two creates workflow rigidity and forces the organiser to know session assignments
at invitation time.

**Impact:** A leader can be invited without knowing their session assignment. Session
leaders must be explicitly attached after invitation acceptance.

**Status:** Active.

---

## Notifications

---

### DEC-015: Transactional Emails Bypass `notification_preferences`

**Decision:** Verification, password reset, leader invitation, and organisation member
invitation emails are sent regardless of a user's `notification_preferences` settings.

**Rationale:** These are required for core account and system function. Opt-out would
break authentication and invitation flows.

**Impact:** These emails are dispatched via dedicated Mailable classes directly,
not through `ResolveNotificationRecipientsService` or preference checks.

**Status:** Active.

---

### DEC-016: `custom` Delivery Scope Is a Placeholder (501)

**Decision:** `delivery_scope = 'custom'` throws `CustomDeliveryNotImplementedException`
(HTTP 501). The enum value is reserved.

**Rationale:** Phase 6 explicitly stated: do not implement partially. The recipient
resolution strategy for a custom-selected list has not been designed.

**Status:** Deliberately incomplete. No implementation timeline.
See `docs/stabilization/OPEN_QUESTIONS.md` Q3.

---

### DEC-017: Leader Messaging Window Computed in Workshop Timezone

**Decision:** The leader messaging time window (4h before `start_at`, 2h after `end_at`)
is computed in the parent workshop's `timezone` field, not UTC.

**Rationale:** Session times are stored as UTC but represent real-world times in the
workshop's location. UTC-relative computation would produce wrong windows for workshops
in non-UTC timezones.

**Impact:** `EnforceLeaderMessagingRulesService` converts session times to workshop
timezone before computing the window. Tests must use non-UTC workshop timezones
to validate this.

**Status:** Active.

---

## Serialization

---

### DEC-018: Role-Aware Resource Classes; No Universal Serializer

**Decision:** Public, Organiser, Participant, Leader, and Self variants of API Resources
are maintained as separate classes (e.g., `PublicLeaderResource` vs
`OrganizerLeaderResource` vs `LeaderSelfProfileResource`).

**Rationale:** `MASTER_PROMPT.md` non-negotiable. A universal serialiser inevitably
leaks private data as features are added. Separate classes make the audience for each
field explicit.

**Impact:** More resource classes to maintain. Adding a field requires updating the
correct resource(s) deliberately.

**Status:** Active, non-negotiable.

---

### DEC-019: `JsonResource::withoutWrapping()` Applied Globally

**Decision:** API responses do not have a `data` envelope.

**Rationale:** Simplifies frontend API consumption. Avoids the `response.data.data`
nesting pattern.

**Status:** Active.

---

## Offline Sync

---

### DEC-020: Sync Version Hash Includes `session_leaders`

**Decision:** `GenerateSyncVersionService` includes `max(session_leaders.updated_at)`
in the SHA-256 hash that determines the sync version.

**Rationale:** Adding or removing a leader assignment changes the roster data in the
sync package. Without including `session_leaders` in the version hash, mobile clients
would not know to re-download after a leader assignment change.

**Impact:** Any leader assignment change invalidates mobile clients' cached sync
packages, triggering a full re-download.

**Status:** Active.

---

### DEC-021: Meeting URLs Are Never in the Sync Package

**Decision:** `BuildWorkshopSyncPackageService` explicitly excludes `meeting_url`,
`meeting_id`, and `meeting_passcode` from both participant and leader sync packages.

**Rationale:** `MASTER_PROMPT.md`: meeting URLs are never in public endpoints. The
sync package is cached on device; if shared or inspected, meeting URLs would be
exposed to unauthorised parties.

**Impact:** Virtual session "Join Meeting" links must be fetched live from the API.
Mobile apps must handle the case where virtual join links are unavailable offline.

**Status:** Active.

---

## Command Center

---

### DEC-022: Command Center as Separate Next.js App (`command/`)

**Decision:** The Command Center is a separate Next.js application (`command/`),
distinct from the tenant admin (`web/`). It uses a separate API route prefix
(`/api/platform/v1/`), separate auth guard, and separate login screen.

**Rationale:** Complete separation prevents any UI-level mixing of platform admin
and tenant admin capabilities. Different audiences, different risk profiles.

**Status:** API fully built. Frontend scaffolded only.

---

### DEC-023: Stripe for Billing; Local Mirror Tables

**Decision:** Stripe handles all billing. Customer, subscription, invoice, and event
data is mirrored into local MySQL tables via Stripe webhooks
(`stripe_customers`, `stripe_subscriptions`, `stripe_invoices`, `stripe_events`).

**Rationale:** Fast querying from the Command Center without hitting the Stripe API
on every request. Webhook-driven sync ensures eventual consistency.

**Impact:** Stripe webhook handler must be implemented to populate mirror tables.
Currently the tables exist but no active webhook handler is wired.

**Status:** Schema active, webhook handler not implemented.
See `OPEN_QUESTIONS.md` Q4.

---

## Feature Gating

---

### DEC-024: Plan Limits Enforced at API Layer; Never UI Only

**Decision:** Workshop count limits, participant limits, and manager count limits are
enforced in `EnforceFeatureGateService` called from Action classes.

**Rationale:** `MASTER_PROMPT.md` non-negotiable. UI-only enforcement is trivially
bypassed by direct API calls.

**Impact:** Every gated action must call the feature gate service before proceeding.
Throws `PlanLimitExceededException` (HTTP 403) on violation.

**Status:** Active, non-negotiable.

---

### DEC-025: Manual Feature Flag Overrides Require Owner Role and Are Audit Logged

**Decision:** `SetManualOverrideAction` may only be called by users with
`organization_users.role = 'owner'`. Every manual override produces an `audit_logs`
entry with the previous value.

**Rationale:** Manual overrides have billing implications. They must be traceable.

**Status:** Active.

---

## Documentation Process

---

### DEC-028: Tests Required for All Phases Going Forward (Added 2026-04-06)

**Decision:** Every phase prompt must include explicit test requirements. Tests must
be written and passing before a phase is considered complete. Tests must cover: happy
path, authorisation rejection paths, privacy boundary enforcement, and tenant isolation.

**Rationale:** The 2026-04-06 audit found that testing was not enforced per-phase.
Going forward, tests are a phase exit criterion, not an afterthought.

**Impact:** Each new phase prompt must include a "Test Requirements" section.
`TESTING_AND_VALIDATION_STRATEGY.md` is the reference document.

**Status:** Active from 2026-04-06 onward.

---

### DEC-029: Documentation Updated Every Phase (Added 2026-04-06)

**Decision:** At the end of every phase, five documentation items must be updated
before the phase is marked complete. See the Phase End Update Requirement in
`PHASE_STATUS.md`.

**Rationale:** The 2026-04-06 audit found `CLAUDE.md` was 4 phases behind and
`BUILD_SEQUENCE_CHECKLIST.md` was entirely unchecked, creating significant
documentation debt in a short time.

**Impact:** 15 minutes of documentation updates per phase prevents multi-phase
correction cycles.

**Status:** Active from 2026-04-06 onward.

---

### DEC-031: Discovery Implemented Ahead of Plan (Added 2026-04-06)

**Decision:** Workshop discovery (`/discover` and `/w/[slug]`) was implemented during
Web Phase 8 despite being listed as a Phase 3 (Growth) product feature in
`MVP_SCOPE.md`.

**Rationale:** Discovery was a natural companion to the public workshop page and
shared the same `PublicWorkshopResource` serialiser. Building it together was
practical at the time.

**Impact:** `MVP_SCOPE.md` incorrectly lists discovery as not yet implemented.
The document has been updated in this remediation round. The implementation is
correct; the earlier document was wrong.

**Status:** Implemented. `MVP_SCOPE.md` updated.
---

## International Address System (Phase 16)

---

### DEC-032: Canonical `addresses` Table — Non-Destructive Migration

**Decision:** Phase 16 introduces a canonical `addresses` table and links it to
`locations`, `leaders`, `organizations`, and `workshop_logistics` via nullable FK
columns (`address_id`, `hotel_address_id`). No existing address columns (`address_line_1`,
`city`, `country`, etc.) are dropped.

**Rationale:** Non-destructive migration allows existing data to be preserved and
migrated progressively via `php artisan addresses:migrate`. Dropping old columns during
the migration phase risks data loss and breaks any clients reading the old fields.

**Impact:** Old flat-address fields are deprecated but remain. The `addresses:migrate`
command backfills `address_id` for existing records. Old columns will be candidates for
removal in a future cleanup phase once all clients consume the new structure.

**Status:** Active.

---

### DEC-033: Country Config as Static PHP — No Runtime DB Calls

**Decision:** Country configuration (labels, formats, administrative area options) is
stored in `config/address_countries.php`. Timezone-to-country inference is in
`config/address_timezones.php`. No database table holds country config.

**Rationale:** Country config changes infrequently and must be available offline.
Static config is cacheable by Laravel's config cache, works offline, and imposes no
DB query overhead. A `countries` DB table would require migrations for every data change.

**Impact:** Updating country config requires a code deploy. The `/address/countries`
endpoint caches responses for 1 hour via `Cache::remember`.

**Status:** Active.

---

### DEC-034: `postal_code` Always VARCHAR — Never Integer

**Decision:** All postal code fields across the schema (`locations.postal_code`,
`leaders.postal_code`, `addresses.postal_code`) are VARCHAR(30), never integer or
numeric types.

**Rationale:** Postal codes in many countries begin with zeros (e.g., US "01234"),
contain letters (e.g., Canadian "K1A 0A6"), or include hyphens. Storing as integer
silently truncates leading zeros and rejects non-numeric codes.

**Impact:** All queries, comparisons, and display must treat postal codes as strings.
`addresses.postal_code` is validated by regex per country but always stored as-is.

**Status:** Active, non-negotiable.
