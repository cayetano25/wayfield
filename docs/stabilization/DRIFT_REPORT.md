# Wayfield – Drift Report

> Stabilization artifact. Documents the gap between intended design (CURRENT_STATE_INTENDED.md)
> and implemented reality (CURRENT_STATE_IMPLEMENTED.md) as of 2026-04.
> Items here are either bugs, incomplete work, or documentation inconsistencies
> that must be resolved before the surface or document is considered stable.

---

## 1. Web Admin Frontend

### Drift: Phases 15 and 16 Not Implemented

| Item | Intended | Actual | Severity |
|---|---|---|---|
| Phase 15 | Subscription and billing UI fully functional | Not started | High |
| Phase 16 | Reports, analytics, attendance summaries | Not started | High |

### Drift: Audit Remediation Items Outstanding

The following items were identified in the post-Phase-14 audit. Each is an incomplete or incorrect behavior in the current web admin implementation.

| Item | Description | Status |
|---|---|---|
| Subscription/entitlement gating | Plan gate UI not wired to entitlement API | Open |
| Attendance summary page | Not rendering live data | Open |
| Notification recipient count | Not displayed post-send | Open |
| Leader invitation resend | Flow not implemented | Open |
| Session capacity remaining | Not shown in session list view | Open |
| Org user role management | Add/remove/change role not functional in UI | Open |
| Error boundary coverage | Incomplete across slide-overs and modals | Open |
| Form validation feedback | Missing on several create/edit forms | Open |
| `useCallback` audit | Not fully completed across all context providers | Open |

---

## 2. Documentation

### Drift: No `docs/` Hierarchy Exists

**Intended:** A structured `docs/` directory as defined in CURRENT_STATE_INTENDED.md and DOCUMENTATION_RESTRUCTURE_PLAN.md.

**Actual:** All documentation files exist as flat files at the repository root. No `docs/` folder exists.

**Severity:** High — discoverability, maintainability, and canonical authority are all impacted.

### Drift: Duplicate and Conflicting Files at Root

The following root files duplicate or conflict with newer canonical versions:

| Root File | Problem | Canonical Replacement |
|---|---|---|
| `IDENTITY_SYSTEM.md` | Older version; replaced by `IDENTITY_AND_AUTH.md` | `docs/01_identity/IDENTITY_AND_AUTH.md` |
| `PERMISSIONS_AND_PRIVACY_MODEL.md` | Old version uses conceptual-only role names without DB mapping table; no staff permissions matrix | `docs/03_multi_tenant/PERMISSIONS_AND_PRIVACY_MODEL.md` (upgraded version) |
| `SESSION_AND_CAPACITY_MODEL.md` | Old version uses wrong field names (`start_time`/`end_time` instead of `start_at`/`end_at`; has `leader_id` FK which was replaced by `session_leaders` junction table) | `docs/02_domain/SESSION_AND_CAPACITY_MODEL.md` (upgraded version) |
| `LEADER_SYSTEM.md` | Old version missing Source Authority, session_id incorrectly on leader_invitations | `docs/02_domain/LEADER_SYSTEM.md` (upgraded version) |
| `WORKSHOP_DOMAIN_MODEL.md` | Old version references `public_visibility` field; canonical schema uses `public_page_enabled` + `public_slug` | `docs/02_domain/WORKSHOP_DOMAIN_MODEL.md` (upgraded version) |
| `pricing.md` | Duplicate; superseded by `PRICING_AND_TIERS.md` | `docs/05_business/PRICING_AND_TIERS.md` |
| `mvp_and_phases.md` | Duplicate; superseded by `MVP_SCOPE.md` | `docs/05_business/MVP_SCOPE.md` |
| `permissions_matrix.md` | Thin summary; superseded by canonical permissions doc | `docs/03_multi_tenant/PERMISSIONS_AND_PRIVACY_MODEL.md` |
| `PLAN.md` | Thin summary; superseded by `PHASED_IMPLEMENTATION_PLAN.md` | `docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md` |
| `SCHEMA_SPEC.md` | Partial schema; superseded by `DATA_SCHEMA_FULL.md` | `docs/02_domain/DATA_SCHEMA_FULL.md` |
| `TECH_STACK_AWS.md` | One-liner stub | `docs/04_infrastructure/TECHNICAL_ARCHITECTURE.md` |
| `aws_foundation_plan.md` | Partially covered by `TECHNICAL_ARCHITECTURE.md` | `docs/04_infrastructure/` |

### Drift: `SESSION_AND_CAPACITY_MODEL.md` Field Name Errors (Root Version)

The root `SESSION_AND_CAPACITY_MODEL.md` contains field names that contradict `DATA_SCHEMA_FULL.md` (Table 18):

| Root File Field | Canonical Field (DATA_SCHEMA_FULL.md) |
|---|---|
| `start_time` | `start_at` |
| `end_time` | `end_at` |
| `leader_id` (direct FK on sessions) | No `leader_id` on sessions; leaders assigned via `session_leaders` junction table |

**Action required:** Deprecate root version; canonical version uses correct field names.

### Drift: Role Model — No `ROLE_MODEL.md` Exists

**Intended:** `ROLE_MODEL.md` is the canonical role authority, cross-referenced by all domain docs.

**Actual:** No `ROLE_MODEL.md` exists. Role information is scattered across `PERMISSIONS_AND_PRIVACY_MODEL.md`, `DATA_SCHEMA_FULL.md`, `IDENTITY_AND_AUTH.md`, and the MASTER_PROMPT.

**Severity:** High — "Organizer" is used as a role name in multiple docs despite not being a stored DB value.

### Drift: "Organizer" Used as a DB Role Name

Multiple documents (notably the root `PERMISSIONS_AND_PRIVACY_MODEL.md` and older domain docs) use "Organizer" and "Organization Admin" as if they are DB enum values.

**Actual DB values:** `owner`, `admin`, `staff`, `billing_admin`

"Organizer" is a conceptual label that maps to `owner` and `admin`. This must be explicit in all canonical documents.

### Drift: Unified User Account Principle Not Explicitly Constitutional

**Intended:** The principle that one `users` row serves all roles (participant, leader, org member) is a constitutional constraint.

**Actual:** This principle exists implicitly in `MASTER_PROMPT.md` and `IDENTITY_AND_AUTH.md` but is not elevated to an explicit, named, cross-referenced rule.

### Drift: `platform_admins` Concept Not Documented

The controller prompt references `platform_admins` as something that should be marked deprecated if retained in schema authority. A search of all project files finds zero references to `platform_admins`. This concept was never documented or implemented. See DECISIONS.md for the decision record.

---

## 3. Command Center

### Drift: Frontend Not Started

**Intended:** A fully built Command Center Next.js application.

**Actual:** Documentation, prompts, and schema references are complete. No code exists.

---

## 4. Mobile

### Drift: Application Not Started

**Intended:** A fully built Expo/React Native mobile application with offline-first sync.

**Actual:** Backend offline sync infrastructure is complete (Phase 7). No Expo/React Native code exists.

---

## 5. Open Technical Questions Contributing to Drift

See OPEN_QUESTIONS.md for the full list. Questions that directly create implementation drift:

- Hybrid session `virtual_participation_allowed` flag not in schema → sessions table is ambiguous for hybrid publish validation
- `public_slug` generation rules not defined → public page URL pattern unspecified
- Soft delete strategy for sessions not decided → deletion behavior undefined in admin UI
- Mobile token refresh expiry duration not decided → mobile auth lifecycle undefined