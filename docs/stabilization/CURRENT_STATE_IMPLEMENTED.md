# Wayfield – Current State: What Has Been Implemented

> Stabilization artifact. Describes the verified implemented state as of 2026-04.
> For intended design, see CURRENT_STATE_INTENDED.md.
> For gaps between the two, see DRIFT_REPORT.md.
> For authoritative status tracking, see docs/06_implementation/PHASE_STATUS.md.

---

## Laravel API Backend

**Status: Complete through Phase 9.**

All backend phases have been implemented. The API is the single source of truth for data, business logic, auth, and enforcement for all surfaces.

### Implemented Capabilities

#### Auth and Identity (Phase 1)
- Email/password registration with `first_name` + `last_name` required
- Email verification flow
- Password reset via secure token
- Login/logout with Laravel Sanctum token management
- `GET /api/v1/me` — authenticated profile retrieval
- `GET /api/v1/me/organizations` — returns array of org memberships
- `organization_users` role model with `owner`, `admin`, `staff`, `billing_admin`
- `auth_methods` table schema-ready for future social login
- `user_2fa_methods` and `user_2fa_recovery_codes` schema-ready for future 2FA
- `user_sessions` audit/lifecycle tracking table

#### Organizations (Phase 1)
- Organization CRUD
- `organization_users` membership model (many-to-many with explicit roles)
- Primary contact fields (`first_name`, `last_name`, `email`, `phone`)
- Tenant scoping enforced on all protected routes

#### Workshops and Locations (Phase 2)
- Workshop CRUD (`session_based`, `event_based`)
- Unique join code generation
- Workshop status transitions: `draft` → `published` → `archived`
- Logistics CRUD (`workshop_logistics` table)
- Public workshop endpoint (privacy-safe serializer)
- `locations` table with org-scoped reusable locations

#### Sessions, Tracks, Capacity, Virtual Delivery (Phase 3)
- Track CRUD
- Session CRUD with `start_at`/`end_at` (UTC, timezone inherited from workshop)
- Session publish validation (blocks publish if virtual/hybrid and `meeting_url` missing)
- Capacity enforcement service (null = unlimited; NOT NULL = backend-enforced limit)
- Overlapping session conflict detection for session-based workshops
- Session selection endpoints
- Participant schedule endpoint (`GET /api/v1/workshops/{workshop}/my-schedule`)

#### Leaders, Invitations, Profiles (Phase 4)
- `leaders` global entity (reusable across organizations)
- `organization_leaders`, `workshop_leaders`, `session_leaders` junction tables
- Leader invitation flow: send → accept/decline → link user account
- Leader-owned profile completion and editing
- Public leader serializer (safe fields only: name, bio, website, city, state)
- `leader_invitations` with token stored hashed; raw token sent in email only

#### Attendance, Roster, Messaging (Phase 5)
- `registrations` and `session_selections` models
- `attendance_records` with `status`, `check_in_method`, `checked_in_at`, `checked_in_by_user_id`
- Participant self-check-in
- Leader manual check-in (requires session assignment)
- No-show marking
- Roster endpoint with phone number visibility enforced by API
- Leader messaging time-window enforcement (4 hours before → 2 hours after session)
- Leader messaging scope enforcement (assigned session participants only)
- Audit logging for leader notifications

#### Notifications (Phase 6)
- `notifications`, `notification_recipients`, `push_tokens`, `notification_preferences` tables
- Queued notification delivery (email, push, in-app channels)
- In-app notification retrieval for current user
- Organizer notification composer (broad scopes)
- Leader notification composer (constrained by Phase 5 rules)
- Push token registration endpoints
- User preference endpoints

#### Offline Sync (Phase 7)
- Workshop sync package endpoint
- Sync version hash generation
- Offline action replay endpoint (idempotent)
- `offline_sync_snapshots` and `offline_action_queue` tables

#### Reporting, Feature Gating (Phase 8)
- Plan entitlement resolution service
- Feature gate middleware
- Usage limit enforcement
- Attendance summary endpoint
- Reporting endpoints (tenant-scoped)

#### Enterprise Extensions (Phase 9)
- Extension point architecture documented and implemented at interface boundary level
- Schema ready for SSO, webhooks, governance additions

#### Dashboard (Purpose-Built Endpoint)
- `GET /api/v1/organizations/{organization}/dashboard` — confirmed operational
- Returns aggregate stats: active workshops, participants, check-ins, sessions today

### Test Data
- Seeder fully replaced; organizer users properly linked via `organization_users`
- Two organizations with complete session/attendance data
- Leaders in varied invitation states
- Test credentials: `owner@wayfield.test` / `Testing!2024`

---

## Web Admin Frontend (Next.js)

**Status: Complete through Phase 14. Phases 15 and 16 are NOT complete.**

### Implemented (Phases 1–14)

| Phase | Scope |
|---|---|
| 1 | Project setup, auth shell, login/logout |
| 2 | Organization context, layout, navigation shell |
| 3 | Dashboard — stat cards, recent activity (wired to API) |
| 4 | Workshop list — index, filters, status badges |
| 5 | Workshop create/edit form |
| 6 | Sessions management — CRUD, tracks, capacity |
| 7 | Leaders — list, invite, invitation status |
| 8 | Participants — list, registration, join code |
| 9 | Attendance and roster — check-in, no-show, override |
| 10 | Notifications — compose, history, scoping UI |
| 11 | Workshop overview and logistics editor |
| 12 | Public page management |
| 13 | Organization settings and user management |
| 14 | Improvement pass — bug fixes, UX hardening, context stability |

### Bug Fixes Confirmed Resolved (Phase 14)
- `UserContext` not fetching organizations on mount
- Organizations endpoint returning single object instead of array
- Workshop creation failing due to `null currentOrg`
- Infinite render loops from missing `useCallback` in `PageContext`
- Undefined leader sessions crashing session views
- Confirmed leaders missing from workshop overview (controller not including them)
- Missing `/leaders` and `/participants` routes
- Participant slide-over crashing on undefined sessions
- Duplicate notification keys from repeated IDs
- Missing Leaders tab in `WorkshopTabs.tsx`
- Dashboard stat cards showing hardcoded zeros

### NOT Implemented (Web Admin)
- Phase 15: Subscription, billing UI, plan enforcement in UI
- Phase 16: Reports, analytics, attendance summaries

### Audit Remediation Items (NOT complete)
See DRIFT_REPORT.md for full list.

---

## Command Center Frontend

**Status: NOT STARTED. No code exists.**

Documentation, prompts, and schema references are complete.

---

## Expo Mobile App

**Status: NOT STARTED. No code exists.**

Backend offline sync infrastructure (Phase 7) is complete. No Expo/React Native code has been written.

---

## Documentation

**Status: Partial. Root-level flat files only. Target `docs/` hierarchy does not exist.**

Some files have been upgraded to include Source Authority headers and canonical cross-references. Others remain in older form. Duplicate and redundant root-level files exist alongside newer versions.

See DOCUMENTATION_RESTRUCTURE_PLAN.md and DOC_REMEDIATION_SUMMARY_2026-04-06.md for the full picture.