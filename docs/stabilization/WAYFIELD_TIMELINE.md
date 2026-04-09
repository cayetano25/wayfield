# Wayfield – Project Timeline

> Stabilization artifact. Records the chronological history of major decisions,
> documentation versions, and implementation milestones.
> For current status, see docs/06_implementation/PHASE_STATUS.md.

---

## Documentation Versioning History

### v1 — Initial Product Documentation
- First complete set of product and domain docs created
- Established core concepts: workshops, sessions, leaders, participants
- Established multi-tenant model with organizations as tenant root
- Established role model: participant, leader, organizer/admin

### v2 — Schema and API Expansion
- `DATA_SCHEMA_FULL.md` introduced as canonical schema reference
- `API_ROUTE_SPEC.md` introduced with full versioned route specification
- Leader invitation workflow formalized

### v3 — Person and Identity Rules Hardened
- `first_name` and `last_name` required everywhere — prohibition on single `name` field
- Social login readiness added to identity model
- 2FA schema tables added as future-ready
- Unified user account principle implicit in identity docs

### v4 — Capacity, Virtual, and Hybrid Rules Added
- Capacity: `null` = unlimited; backend enforcement mandatory
- Virtual/hybrid session publish validation: `meeting_url` required
- `delivery_type` enum formalized: `in_person`, `virtual`, `hybrid`
- Public meeting link restriction added

### v5 — Leader Messaging Rules Codified (Current Package Version)
- Leader messaging constraint made explicit and non-negotiable:
  - Scope: assigned session participants only
  - Time window: 4 hours before → 2 hours after session
  - Backend enforcement mandatory
  - Audit logging mandatory
- `MASTER_PROMPT.md` updated to v4 with all above rules
- Package README updated to v5

---

## API Backend Build (Laravel)

### Phase 0 — Architecture and Project Setup
- Repository structure established
- Laravel project scaffolded
- MySQL, queue, email, and storage configuration
- Module folder conventions defined

### Phase 1 — Identity, People, Tenant Foundation
- Users, auth, organizations implemented
- Sanctum token auth chosen as implementation mechanism
- `user_sessions` established as audit/lifecycle companion to Sanctum

### Phase 2 — Workshops, Locations, Public Pages
- Workshop CRUD and status transitions
- Join code generation
- Public/private serializer separation established

### Phase 3 — Sessions, Tracks, Capacity, Virtual
- Session and track CRUD
- Capacity enforcement service
- Overlap detection service
- Virtual publish validation

### Phase 4 — Leaders and Invitations
- Leader invitation lifecycle
- Leader profile ownership
- Workshop and session leader associations
- Session_leaders junction table (replacing earlier `leader_id` FK on sessions)

### Phase 5 — Attendance, Roster, Messaging
- Registration and session selection models
- Attendance records and check-in flows
- Leader messaging enforcement service

### Phase 6 — Notifications
- Notification delivery pipeline
- Queued email/push/in-app delivery

### Phase 7 — Offline Sync
- Workshop sync package generation
- Offline action replay (idempotent)

### Phase 8 — Reporting and Feature Gating
- Plan entitlement resolution
- Feature gate middleware
- Reporting endpoints

### Phase 9 — Enterprise Readiness (Finalized)
- Extension point architecture
- Phase 9 finalized with revised prompt addressing five original gaps

---

## Web Admin Frontend Build (Next.js)

### Phases 1–6 — Foundation Through Sessions
- Auth shell, org context, dashboard, workshop CRUD, sessions management
- Multiple bugs surfaced and resolved:
  - `UserContext` fetch on mount
  - Organizations endpoint array vs object
  - `currentOrg` null guard on workshop creation
  - `useCallback` missing in `PageContext`

### Phases 7–10 — Leaders, Participants, Attendance, Notifications
- Leaders list, invite flow, invitation status
- Participant list and join code management
- Attendance and roster with check-in/no-show
- Notification compose and history
- Additional bugs resolved:
  - Confirmed leaders missing from workshop overview
  - Missing `/leaders` and `/participants` routes
  - Participant slide-over undefined sessions crash
  - Duplicate notification keys

### Phases 11–14 — Logistics, Public Pages, Settings, Improvement Pass
- Workshop logistics editor
- Public page management
- Organization settings and user management
- Improvement pass (Phase 14) addressing remaining UX and stability issues:
  - Dashboard stat cards wired to API (previously hardcoded zeros)
  - Dashboard stats endpoint purpose-built: `GET /api/v1/organizations/{organization}/dashboard`
  - Test seeder fully replaced
  - Leaders tab added to `WorkshopTabs.tsx`

---

## Documentation Upgrade Pass

- Selected domain spec files upgraded to include Source Authority headers
- Cross-references to `DATA_SCHEMA_FULL.md` table numbers added
- Ambiguities resolved in upgraded files
- Files upgraded: `IDENTITY_AND_AUTH.md` (new), `LEADER_SYSTEM.md`, `PERMISSIONS_AND_PRIVACY_MODEL.md`, `SESSION_AND_CAPACITY_MODEL.md`, `WORKSHOP_DOMAIN_MODEL.md`
- Upgraded versions drafted; root files still contain old versions pending restructure

---

## Stabilization and Audit (2026-04)

- Post-Phase-14 audit conducted
- Audit items identified (see DRIFT_REPORT.md)
- Remediation documentation produced:
  - `PHASE_STATUS.md` — canonical progress tracker
  - Command Center documentation suite
  - `docs/stabilization/` suite (this batch)
- Decisions recorded in DECISIONS.md
- Open questions formalized in OPEN_QUESTIONS.md
- Documentation restructure plan produced

---

## What Has Not Yet Happened

- Web Admin Phase 15 (Billing UI) — not started
- Web Admin Phase 16 (Reports/Analytics) — not started
- Audit remediation item closure — not started
- Command Center Frontend build — not started
- Mobile App build — not started
- `docs/` hierarchy migration — not started
- `ROLE_MODEL.md` creation — not started