# Wayfield — Documentation Index

Wayfield is a production-bound, multi-tenant SaaS platform for managing photography
workshops and creative education events.

This repository is a monorepo containing four applications and a complete documentation
suite. All canonical documentation lives under `docs/`.

---

## Section 1 — Applications

| Directory | Application | Status |
|---|---|---|
| `api/` | Laravel backend API | Complete through Phase 9 + CC API |
| `web/` | Next.js web admin | Complete through Improvement Phase 14 |
| `command/` | Next.js Command Center | Scaffolded only — frontend not started |
| `mobile/` | Expo React Native | Scaffolded only — no domain screens |

Each application has its own `CLAUDE.md` with app-specific conventions.

---

## Section 2 — Current Build Status
API Backend:       Phase 9 complete + Command Center API complete
Web / Improvement: Phase 14 complete (Add Participants to Sessions)
NOT STARTED — do not describe as complete:
Phase 15:              Dashboard Analytics
Phase 16:              International Address System
Audit Remediation:     10 items identified, none implemented
Command Center Web:    command/ scaffolded only
Mobile:                mobile/ scaffolded only

**Canonical progress tracker:** `docs/06_implementation/PHASE_STATUS.md`

---

## Section 3 — Document Authority Hierarchy

When two documents conflict, the higher-ranked document governs.

| Rank | Document(s) | Scope |
|---|---|---|
| 1 (highest) | `MASTER_PROMPT.md` | Constitutional rules — override everything |
| 2 | `docs/01_product/MVP_SCOPE.md`, `docs/01_product/PRICING_AND_TIERS.md` | Product scope and plan entitlements |
| 3 | `docs/03_schema/DATA_SCHEMA_FULL.md` | Field names and table structure — override domain docs on naming conflicts |
| 4 | `docs/02_domain/*` | Domain behaviour and business rules |
| 5 | `docs/05_architecture/*`, `docs/06_implementation/*` | Architecture patterns and build tactics |
| 6 | `docs/stabilization/*` | Audit snapshots and decision log — informational, not prescriptive |

**Role authority:** `docs/02_domain/ROLE_MODEL.md` — supersedes `permissions_matrix.md`
(deprecated) on all role and permission questions.

---

## Section 4 — Documentation Directory
docs/
├── 01_product/
│   ├── MVP_SCOPE.md                     Product MVP scope and phase roadmap
│   └── PRICING_AND_TIERS.md             Plan tiers and feature entitlements (authority)
│
├── 02_domain/                           What the system must do
│   ├── IDENTITY_AND_AUTH.md             Auth spec, Sanctum, user_sessions coexistence
│   ├── PERSON_AND_CONTACT_MODEL.md      first_name/last_name rules for all people
│   ├── MULTI_TENANT_MODEL.md            Tenant isolation rules
│   ├── ROLE_MODEL.md                    CANONICAL role taxonomy — all roles and DB mappings
│   ├── PERMISSIONS_AND_PRIVACY_MODEL.md Full permission matrix and privacy rules
│   ├── UNIFIED_USER_ACCOUNT.md          One account for all roles; org user management
│   ├── WORKSHOP_DOMAIN_MODEL.md         Workshop types, status, logistics
│   ├── SESSION_AND_CAPACITY_MODEL.md    Sessions, capacity, virtual delivery
│   ├── LEADER_SYSTEM.md                 Leader lifecycle, invitations, profile ownership
│   ├── ATTENDANCE_AND_ROSTER_SYSTEM.md  Attendance, roster, phone visibility
│   ├── NOTIFICATIONS_AND_MESSAGING_SYSTEM.md  Notification types, leader constraints
│   ├── SUBSCRIPTION_AND_FEATURE_GATING.md     Plan enforcement rules
│   └── OFFLINE_SYNC_STRATEGY.md         Mobile offline sync design
│
├── 03_schema/
│   └── DATA_SCHEMA_FULL.md              Canonical schema — field names override domain docs
│
├── 04_api/
│   ├── API_AND_SERVICE_BOUNDARIES.md    Service module responsibilities
│   └── API_ROUTE_SPEC.md                Complete HTTP API surface
│
├── 05_architecture/
│   ├── TECHNICAL_ARCHITECTURE.md        Stack overview and AWS infrastructure
│   └── MODULE_BOUNDARIES.md             Laravel domain module structure
│
├── 06_implementation/
│   ├── LARAVEL_IMPLEMENTATION_PLAN.md   Laravel build patterns and conventions
│   ├── PHASED_IMPLEMENTATION_PLAN.md    API Phases 0–9 scope detail
│   ├── PHASE_STATUS.md                  CANONICAL progress tracker (replaces BUILD_SEQUENCE_CHECKLIST.md)
│   ├── WEB_PHASE_PLAN.md                Web phases 1–14 scope and status
│   ├── PHASE_PROMPTS.md                 Claude Code prompts for all phases
│   └── UNIFIED_USER_ACCOUNT_PLAN.md     Phased implementation guide for unified account model
│
├── 07_testing/
│   ├── TESTING_AND_VALIDATION_STRATEGY.md  Test coverage requirements — updated 2026-04-06
│   └── OFFLINE_SYNC_CONTRACT.md            Mobile sync API contract
│
├── command_center/
│   ├── COMMAND_CENTER_OVERVIEW.md
│   ├── COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
│   ├── COMMAND_CENTER_SCHEMA.md
│   └── NAVIGATION_SPEC.md
│
├── stabilization/                        Audit snapshots and living decision log
│   ├── DECISIONS.md                      Decision log — update every phase
│   ├── OPEN_QUESTIONS.md                 Unresolved questions — review every phase
│   ├── CURRENT_STATE_IMPLEMENTED.md      Audit snapshot 2026-04-06
│   ├── CURRENT_STATE_INTENDED.md         Audit snapshot 2026-04-06
│   ├── DRIFT_REPORT.md                   Gap analysis 2026-04-06
│   ├── WAYFIELD_TIMELINE.md              Build chronology
│   └── DOCUMENTATION_RESTRUCTURE_PLAN.md
│
└── deprecated/                           Retired files — do not use; kept for traceability
├── IDENTITY_SYSTEM.md                Superseded by IDENTITY_AND_AUTH.md
├── BUILD_SEQUENCE_CHECKLIST.md       Never maintained; superseded by PHASE_STATUS.md
├── permissions_matrix.md             Superseded by ROLE_MODEL.md
├── PLAN.md                           Superseded by PHASE_STATUS.md
├── SCHEMA_SPEC.md                    Partial fragment; superseded by DATA_SCHEMA_FULL.md
├── TECH_STACK_AWS.md                 No content; superseded by TECHNICAL_ARCHITECTURE.md
├── mvp_and_phases.md                 Superseded by MVP_SCOPE.md
├── pricing.md                        Superseded by PRICING_AND_TIERS.md
├── aws_foundation_plan.md            Superseded by TECHNICAL_ARCHITECTURE.md
└── UserAccounts.md                   Design prompt; archived for traceability

---

## Section 5 — Key Architectural Principles

These are stated here for quick orientation. Each has a canonical source document.

**Unified user account model.** One `users` record per person. Role is derived from
relationships, not from a field on `users`. A person may simultaneously hold participant,
leader, and organisation manager contexts.
→ @docs/02_domain/UNIFIED_USER_ACCOUNT.md · @docs/02_domain/ROLE_MODEL.md

**Two isolated identity systems.** Tenant users (`users` table, `auth:sanctum`) are
completely isolated from platform administrators (`admin_users`, `auth:platform_admin`).
A tenant token is always rejected on platform routes and vice versa.
→ @docs/02_domain/IDENTITY_AND_AUTH.md · @docs/02_domain/ROLE_MODEL.md

**Multi-tenant isolation.** Every protected resource is scoped by `organisation_id`.
Cross-tenant leakage is a critical failure.
→ @docs/02_domain/MULTI_TENANT_MODEL.md

**`capacity = NULL` means unlimited.** Never treat a null capacity as zero.
→ @docs/02_domain/SESSION_AND_CAPACITY_MODEL.md

**Meeting URLs are never public.** Not in public endpoints, not in offline sync packages.
→ @MASTER_PROMPT.md · @docs/02_domain/SESSION_AND_CAPACITY_MODEL.md

**Backend enforcement always.** Capacity limits, plan limits, privacy, messaging
constraints, and role checks are enforced in the API layer. UI is supplementary.
→ @MASTER_PROMPT.md

---

## Section 6 — Phase End Checklist

At the end of every phase, update all five items before marking the phase done:

1. `docs/06_implementation/PHASE_STATUS.md` — mark phase complete with notes
2. `CLAUDE.md` — update "Current Build Phase" block
3. `docs/stabilization/DECISIONS.md` — log any non-obvious decisions
4. `docs/stabilization/OPEN_QUESTIONS.md` — close resolved; add new questions
5. Schema and API docs — update `DATA_SCHEMA_FULL.md` and `API_ROUTE_SPEC.md` if changed

Tests must be passing before a phase is marked complete.