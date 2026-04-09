# Wayfield – Current State: What Is Intended

> Stabilization artifact. Describes the full intended design and completion state.
> For what has actually been built, see CURRENT_STATE_IMPLEMENTED.md.
> For gaps between the two, see DRIFT_REPORT.md.

---

## Design Intent Summary

Wayfield is intended to be a production-grade multi-tenant SaaS platform for photography workshops and creative education events. It is designed for phased solo-builder delivery and must support:

- A shared identity system across all surfaces
- Role-based access with explicit DB role values
- Multi-tenant data isolation enforced at the backend layer
- Offline-first mobile experience
- A backend API that is the single enforcement point for all business rules
- Two organizer-facing web surfaces (Web Admin and Command Center) with distinct purposes
- A participant/leader mobile app

---

## Intended Architecture

### Backend (Laravel API)
- Single API serving all surfaces
- MySQL on AWS RDS
- Sanctum for token auth
- SQS for async queues
- SES for email
- S3 for file storage
- CloudWatch for logging

### Web Admin (Next.js)
- Management and configuration surface for organizers
- All 16 phases complete
- Subscription, billing, and plan enforcement visible in UI (Phase 15)
- Reports, analytics, attendance summaries (Phase 16)

### Command Center (Next.js)
- Separate Next.js application
- Day-of operational surface for organizers running workshops in the field
- All 6 Command Center phases complete (CC-1 through CC-6)
- Real-time attendance, roster management, notifications

### Expo Mobile App
- Participant and leader field experience
- Offline-first after initial sync
- Session selection, self-check-in, personal schedule, logistics
- Leader roster, check-in management, constrained messaging

---

## Intended Identity Model

A single `users` table serves as the canonical identity for ALL roles:

- Participants: have a `users` row; join workshops via registration
- Leaders: have a `users` row (linked after invitation acceptance) + a `leaders` row for profile
- Organizers/Staff: have a `users` row + an `organization_users` row with an explicit role

No surface has a separate auth system. One email/password account works across Web Admin, Command Center, and mobile app.

This is the **unified user account principle** — a constitutional design constraint.

---

## Intended Role Model

Roles are stored in `organization_users.role` as an enum:

| DB Value | Conceptual Label | Description |
|---|---|---|
| `owner` | Owner | Full org control including billing and member management |
| `admin` | Admin | Full workshop and operational management |
| `staff` | Staff | Operational access (attendance, roster); no org management |
| `billing_admin` | Billing Admin | Billing only; no workshop or participant access |

"Organizer" is a **conceptual label only**. It maps to `owner` and `admin` in all authorization policies.

Leaders are NOT in `organization_users`. They are in the `leaders` table and linked via `organization_leaders`, `workshop_leaders`, and `session_leaders`.

Participants are NOT in `organization_users`. They are linked to workshops via `registrations`.

`ROLE_MODEL.md` is the intended canonical authority for this model.

---

## Intended Documentation Structure
docs/
00_overview/
README.md
MASTER_PROMPT.md
01_identity/
IDENTITY_AND_AUTH.md        ← canonical; replaces root IDENTITY_SYSTEM.md
ROLE_MODEL.md               ← new canonical role authority
02_domain/
WORKSHOP_DOMAIN_MODEL.md
SESSION_AND_CAPACITY_MODEL.md
LEADER_SYSTEM.md
ATTENDANCE_AND_ROSTER_SYSTEM.md
NOTIFICATIONS_AND_MESSAGING_SYSTEM.md
PERSON_AND_CONTACT_MODEL.md
DATA_SCHEMA_FULL.md
API_ROUTE_SPEC.md
API_AND_SERVICE_BOUNDARIES.md
03_multi_tenant/
MULTI_TENANT_MODEL.md
PERMISSIONS_AND_PRIVACY_MODEL.md
04_infrastructure/
TECHNICAL_ARCHITECTURE.md
TECH_STACK_AWS.md
OFFLINE_SYNC_STRATEGY.md
05_business/
PRICING_AND_TIERS.md        ← canonical; replaces root pricing.md
SUBSCRIPTION_AND_FEATURE_GATING.md
MVP_SCOPE.md                ← canonical; replaces root mvp_and_phases.md
06_implementation/
PHASE_STATUS.md             ← canonical progress tracker
PHASED_IMPLEMENTATION_PLAN.md
LARAVEL_IMPLEMENTATION_PLAN.md
MODULE_BOUNDARIES.md
BUILD_SEQUENCE_CHECKLIST.md
PHASE_PROMPTS.md
TESTING_AND_VALIDATION_STRATEGY.md
command_center/
COMMAND_CENTER_OVERVIEW.md
COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
COMMAND_CENTER_SCHEMA.md
NAVIGATION_SPEC.md
COMMAND_CENTER_PHASE_PROMPTS.md
stabilization/
CURRENT_STATE_IMPLEMENTED.md
CURRENT_STATE_INTENDED.md
DRIFT_REPORT.md
WAYFIELD_TIMELINE.md
DECISIONS.md
OPEN_QUESTIONS.md
DOCUMENTATION_RESTRUCTURE_PLAN.md
DOC_REMEDIATION_SUMMARY_2026-04-06.md

Root-level files that duplicate the `docs/` hierarchy are intended to be deprecated with wrapper files pointing to canonical locations.

---

## Intended Completion Milestones

| Milestone | Intended State |
|---|---|
| API Backend | All phases 0–9 complete ← ACHIEVED |
| Web Admin | All phases 1–16 complete |
| Audit Remediation | All audit items closed |
| Command Center | All phases CC-1–CC-6 complete |
| Mobile | All phases complete |
| Docs structure | Full `docs/` hierarchy, root duplicates deprecated |
| ROLE_MODEL.md | Created and cross-referenced by all domain docs |