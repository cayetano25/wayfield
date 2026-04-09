# Wayfield – Documentation Restructure Plan

> Stabilization artifact. Defines the target documentation hierarchy and the
> migration path from the current flat root structure to the target `docs/` structure.
> See DEC-014 for the decision record.
> See DOC_REMEDIATION_SUMMARY_2026-04-06.md for per-file actions taken.

---

## Current State

All documentation files exist as a flat list at the repository root. There is no `docs/` directory. Some files are canonical upgraded versions; others are older duplicates. The full list of root documentation files and their disposition is in DOC_REMEDIATION_SUMMARY_2026-04-06.md.

---

## Target Structure

docs/
│
├── 00_overview/
│   ├── README.md                            ← new; repo orientation and doc map
│   └── MASTER_PROMPT.md                     ← moved from root
│
├── 01_identity/
│   ├── IDENTITY_AND_AUTH.md                 ← moved from root (upgraded version)
│   └── ROLE_MODEL.md                        ← NEW; canonical role authority (DEC-011)
│
├── 02_domain/
│   ├── DATA_SCHEMA_FULL.md                  ← moved from root
│   ├── API_ROUTE_SPEC.md                    ← moved from root
│   ├── API_AND_SERVICE_BOUNDARIES.md        ← moved from root
│   ├── WORKSHOP_DOMAIN_MODEL.md             ← moved from root (upgraded version)
│   ├── SESSION_AND_CAPACITY_MODEL.md        ← moved from root (upgraded version)
│   ├── LEADER_SYSTEM.md                     ← moved from root (upgraded version)
│   ├── ATTENDANCE_AND_ROSTER_SYSTEM.md      ← moved from root
│   ├── NOTIFICATIONS_AND_MESSAGING_SYSTEM.md← moved from root
│   └── PERSON_AND_CONTACT_MODEL.md          ← moved from root
│
├── 03_multi_tenant/
│   ├── MULTI_TENANT_MODEL.md                ← moved from root
│   └── PERMISSIONS_AND_PRIVACY_MODEL.md     ← moved from root (upgraded version)
│
├── 04_infrastructure/
│   ├── TECHNICAL_ARCHITECTURE.md            ← moved from root
│   ├── TECH_STACK_AWS.md                    ← moved from root (or merged into above)
│   ├── aws_foundation_plan.md               ← moved from root (or merged into above)
│   └── OFFLINE_SYNC_STRATEGY.md             ← moved from root
│
├── 05_business/
│   ├── PRICING_AND_TIERS.md                 ← moved from root (canonical)
│   ├── SUBSCRIPTION_AND_FEATURE_GATING.md   ← moved from root
│   └── MVP_SCOPE.md                         ← moved from root (canonical)
│
├── 06_implementation/
│   ├── PHASE_STATUS.md                      ← NEW; canonical progress tracker (DEC-013)
│   ├── PHASED_IMPLEMENTATION_PLAN.md        ← moved from root
│   ├── LARAVEL_IMPLEMENTATION_PLAN.md       ← moved from root
│   ├── MODULE_BOUNDARIES.md                 ← moved from root
│   ├── BUILD_SEQUENCE_CHECKLIST.md          ← moved from root
│   ├── PHASE_PROMPTS.md                     ← moved from root
│   └── TESTING_AND_VALIDATION_STRATEGY.md   ← moved from root
│
├── command_center/
│   ├── COMMAND_CENTER_OVERVIEW.md           ← NEW (produced in prior batch)
│   ├── COMMAND_CENTER_IMPLEMENTATION_GUIDE.md← NEW (produced in prior batch)
│   ├── COMMAND_CENTER_SCHEMA.md             ← NEW (produced in prior batch)
│   ├── NAVIGATION_SPEC.md                   ← NEW (produced in prior batch)
│   └── COMMAND_CENTER_PHASE_PROMPTS.md      ← NEW (produced in prior batch)
│
└── stabilization/
├── CURRENT_STATE_IMPLEMENTED.md         ← NEW (this batch)
├── CURRENT_STATE_INTENDED.md            ← NEW (this batch)
├── DRIFT_REPORT.md                      ← NEW (this batch)
├── WAYFIELD_TIMELINE.md                 ← NEW (this batch)
├── DECISIONS.md                         ← NEW (this batch)
├── OPEN_QUESTIONS.md                    ← NEW (this batch)
├── DOCUMENTATION_RESTRUCTURE_PLAN.md    ← NEW (this batch)
└── DOC_REMEDIATION_SUMMARY_2026-04-06.md← NEW (this batch)

---

## Root Files: Disposition After Migration

Each root-level documentation file becomes one of:

| Disposition | Description |
|---|---|
| **Move** | File is canonical; moved to target path; no root remnant |
| **Move (upgraded)** | Upgraded version moved to target path; old root version deprecated |
| **Deprecate** | File is a duplicate or superseded; root file becomes a thin deprecation wrapper |
| **Merge** | Content folded into another file; original deprecated |
| **Keep at root** | File belongs at root (e.g., repo-level README) |

See DOC_REMEDIATION_SUMMARY_2026-04-06.md for per-file disposition.

---

## New Files Required (Not Yet Created)

| File | Description | Priority |
|---|---|---|
| `docs/00_overview/README.md` | Doc map and repo orientation | High |
| `docs/01_identity/ROLE_MODEL.md` | Canonical role authority (DEC-011) | High — before Phase 15 |

---

## Migration Execution Notes

### Step 1 — Create `docs/` Directory Structure
Create all subdirectory paths listed in the target structure. Do not move files yet.

### Step 2 — Migrate Canonical Files
Move files with "Move" or "Move (upgraded)" disposition to their target paths. Update any cross-references within those files.

### Step 3 — Create Deprecation Wrappers
For each "Deprecate" disposition, replace the root file content with the short deprecation wrapper format:

DEPRECATED
This file has been deprecated as of 2026-04.
Canonical replacement: docs/<path/to/canonical.md>
Reason: <brief reason>

### Step 4 — Create New Files
Create `docs/00_overview/README.md` and `docs/01_identity/ROLE_MODEL.md`.

### Step 5 — Verify Cross-References
Search all files for references to deprecated root paths. Update to canonical paths.

### Step 6 — Update PHASE_STATUS.md
Record documentation restructure completion in PHASE_STATUS.md.

---

## Files That Remain at Root After Migration

| File | Reason |
|---|---|
| `README.md` | Standard repo root README; will be updated to point to `docs/00_overview/README.md` |

All other documentation moves under `docs/`. No new documentation should be created at the root after migration.

---

## Constraints

- Do not delete any file during migration. Deprecated files become wrappers.
- Do not break existing links or references without creating a redirect or wrapper.
- Migration must happen before Phase 15 begins so that new documentation created during Phase 15 goes in the correct location from the start.
- `ROLE_MODEL.md` must be created as part of or immediately before Phase 15 work.
