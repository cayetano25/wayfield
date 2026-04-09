# Wayfield – Documentation Remediation Summary

**Date:** 2026-04-06
**Prepared by:** Documentation Remediation Pass (post-Phase-14 audit)
**Authority:** Controller prompt + audit report

> This file records the disposition of every documentation file reviewed during the
> 2026-04 stabilization pass. It is the audit trail for documentation changes.
> Actions listed here are intended (plan); actual execution status is tracked in OQ-015.

---

## Remediation Actions Key

| Action | Meaning |
|---|---|
| `MOVE` | File is canonical; move to target path under `docs/` |
| `MOVE_UPGRADED` | An upgraded version exists; move upgraded version; deprecate root old version |
| `DEPRECATE` | File is a duplicate or superseded; replace with thin deprecation wrapper |
| `MERGE` | Content absorbed into another file; original deprecated |
| `NEW` | File did not exist; created during this remediation pass |
| `KEEP_ROOT` | File stays at root (standard repo convention) |
| `NO_ACTION` | File reviewed; no change needed in this pass |

---

## Per-File Remediation Table

### Root-Level Documentation Files

| File Path | Action | Reason | Canonical Replacement |
|---|---|---|---|
| `README.md` | `KEEP_ROOT` | Standard repo root file; will be updated to point to `docs/00_overview/README.md` | `docs/00_overview/README.md` (new) |
| `MASTER_PROMPT.md` | `MOVE` | Constitutional authority; canonical; no duplicate | `docs/00_overview/MASTER_PROMPT.md` |
| `DATA_SCHEMA_FULL.md` | `MOVE` | Canonical schema source; no duplicate of concern | `docs/02_domain/DATA_SCHEMA_FULL.md` |
| `API_ROUTE_SPEC.md` | `MOVE` | Canonical API spec; no duplicate | `docs/02_domain/API_ROUTE_SPEC.md` |
| `API_AND_SERVICE_BOUNDARIES.md` | `MOVE` | No duplicate; move to domain folder | `docs/02_domain/API_AND_SERVICE_BOUNDARIES.md` |
| `IDENTITY_AND_AUTH.md` | `MOVE` | Upgraded canonical version; replaces `IDENTITY_SYSTEM.md` | `docs/01_identity/IDENTITY_AND_AUTH.md` |
| `IDENTITY_SYSTEM.md` | `DEPRECATE` | Superseded by `IDENTITY_AND_AUTH.md`; older version missing Sanctum note and full open-question refs | `docs/01_identity/IDENTITY_AND_AUTH.md` |
| `WORKSHOP_DOMAIN_MODEL.md` | `MOVE_UPGRADED` | Root version references `public_visibility` field; canonical uses `public_page_enabled` + `public_slug`; upgraded version has Source Authority header | `docs/02_domain/WORKSHOP_DOMAIN_MODEL.md` |
| `SESSION_AND_CAPACITY_MODEL.md` | `MOVE_UPGRADED` | Root version has wrong field names (`start_time`/`end_time` vs `start_at`/`end_at`; `leader_id` FK vs `session_leaders` junction); upgraded version corrected | `docs/02_domain/SESSION_AND_CAPACITY_MODEL.md` |
| `LEADER_SYSTEM.md` | `MOVE_UPGRADED` | Root version missing Source Authority; has `session_id` incorrectly on `leader_invitations`; upgraded version corrected | `docs/02_domain/LEADER_SYSTEM.md` |
| `ATTENDANCE_AND_ROSTER_SYSTEM.md` | `MOVE` | No duplicate; needs Source Authority header added on move | `docs/02_domain/ATTENDANCE_AND_ROSTER_SYSTEM.md` |
| `NOTIFICATIONS_AND_MESSAGING_SYSTEM.md` | `MOVE` | No duplicate; needs Source Authority header added on move | `docs/02_domain/NOTIFICATIONS_AND_MESSAGING_SYSTEM.md` |
| `PERSON_AND_CONTACT_MODEL.md` | `MOVE` | No duplicate; needs Source Authority header added on move | `docs/02_domain/PERSON_AND_CONTACT_MODEL.md` |
| `PERMISSIONS_AND_PRIVACY_MODEL.md` | `MOVE_UPGRADED` | Root version uses "Organizer" and "Organization Admin" as role names without DB mapping; no staff permissions matrix; no source authority. Upgraded version has full DB role mapping table and staff permissions matrix | `docs/03_multi_tenant/PERMISSIONS_AND_PRIVACY_MODEL.md` |
| `MULTI_TENANT_MODEL.md` | `MOVE` | No duplicate; needs Source Authority header added on move | `docs/03_multi_tenant/MULTI_TENANT_MODEL.md` |
| `TECHNICAL_ARCHITECTURE.md` | `MOVE` | No duplicate | `docs/04_infrastructure/TECHNICAL_ARCHITECTURE.md` |
| `TECH_STACK_AWS.md` | `MERGE` | One-liner stub; content covered by `TECHNICAL_ARCHITECTURE.md`; deprecate after merge | `docs/04_infrastructure/TECHNICAL_ARCHITECTURE.md` |
| `aws_foundation_plan.md` | `MERGE` | Content partially covered by `TECHNICAL_ARCHITECTURE.md`; AWS-specific notes should be folded in | `docs/04_infrastructure/TECHNICAL_ARCHITECTURE.md` |
| `OFFLINE_SYNC_STRATEGY.md` | `MOVE` | No duplicate; needs Source Authority header | `docs/04_infrastructure/OFFLINE_SYNC_STRATEGY.md` |
| `PRICING_AND_TIERS.md` | `MOVE` | Canonical; `pricing.md` is the duplicate | `docs/05_business/PRICING_AND_TIERS.md` |
| `pricing.md` | `DEPRECATE` | Duplicate of `PRICING_AND_TIERS.md`; identical content | `docs/05_business/PRICING_AND_TIERS.md` |
| `SUBSCRIPTION_AND_FEATURE_GATING.md` | `MOVE` | No duplicate | `docs/05_business/SUBSCRIPTION_AND_FEATURE_GATING.md` |
| `MVP_SCOPE.md` | `MOVE` | Canonical; `mvp_and_phases.md` is the duplicate | `docs/05_business/MVP_SCOPE.md` |
| `mvp_and_phases.md` | `DEPRECATE` | Older duplicate of `MVP_SCOPE.md`; less detailed | `docs/05_business/MVP_SCOPE.md` |
| `PHASED_IMPLEMENTATION_PLAN.md` | `MOVE` | Canonical; `PLAN.md` is the thin duplicate | `docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md` |
| `PLAN.md` | `DEPRECATE` | Thin summary version; superseded by `PHASED_IMPLEMENTATION_PLAN.md` | `docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md` |
| `LARAVEL_IMPLEMENTATION_PLAN.md` | `MOVE` | No duplicate | `docs/06_implementation/LARAVEL_IMPLEMENTATION_PLAN.md` |
| `MODULE_BOUNDARIES.md` | `MOVE` | No duplicate | `docs/06_implementation/MODULE_BOUNDARIES.md` |
| `BUILD_SEQUENCE_CHECKLIST.md` | `MOVE` | No duplicate | `docs/06_implementation/BUILD_SEQUENCE_CHECKLIST.md` |
| `PHASE_PROMPTS.md` | `MOVE` | Canonical API backend phase prompts | `docs/06_implementation/PHASE_PROMPTS.md` |
| `TESTING_AND_VALIDATION_STRATEGY.md` | `MOVE` | No duplicate | `docs/06_implementation/TESTING_AND_VALIDATION_STRATEGY.md` |
| `SCHEMA_SPEC.md` | `DEPRECATE` | Partial schema extract; superseded by `DATA_SCHEMA_FULL.md` | `docs/02_domain/DATA_SCHEMA_FULL.md` |
| `permissions_matrix.md` | `DEPRECATE` | Thin summary; superseded by canonical `PERMISSIONS_AND_PRIVACY_MODEL.md` | `docs/03_multi_tenant/PERMISSIONS_AND_PRIVACY_MODEL.md` |

---

### New Files Created During This Pass

| File Path | Action | Description |
|---|---|---|
| `docs/06_implementation/PHASE_STATUS.md` | `NEW` | Canonical progress tracker (DEC-013); produced in prior batch |
| `docs/command_center/COMMAND_CENTER_OVERVIEW.md` | `NEW` | Command Center platform overview; produced in prior batch |
| `docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md` | `NEW` | Command Center build guide; produced in prior batch |
| `docs/command_center/COMMAND_CENTER_SCHEMA.md` | `NEW` | Command Center API reference; produced in prior batch |
| `docs/command_center/NAVIGATION_SPEC.md` | `NEW` | Command Center navigation spec; produced in prior batch |
| `docs/command_center/COMMAND_CENTER_PHASE_PROMPTS.md` | `NEW` | Command Center build prompts (CC-1 through CC-6); produced in prior batch |
| `docs/stabilization/CURRENT_STATE_IMPLEMENTED.md` | `NEW` | Verified implemented state; this batch |
| `docs/stabilization/CURRENT_STATE_INTENDED.md` | `NEW` | Full intended design; this batch |
| `docs/stabilization/DRIFT_REPORT.md` | `NEW` | Gap analysis; this batch |
| `docs/stabilization/WAYFIELD_TIMELINE.md` | `NEW` | Project chronology; this batch |
| `docs/stabilization/DECISIONS.md` | `NEW` | Decisions log with new entries DEC-011 through DEC-016; this batch |
| `docs/stabilization/OPEN_QUESTIONS.md` | `NEW` | Unresolved questions OQ-001 through OQ-015; this batch |
| `docs/stabilization/DOCUMENTATION_RESTRUCTURE_PLAN.md` | `NEW` | Migration plan for `docs/` hierarchy; this batch |
| `docs/stabilization/DOC_REMEDIATION_SUMMARY_2026-04-06.md` | `NEW` | This file; this batch |

---

### Files Decided Against (Not Created)

| Concept | Reason Not Created |
|---|---|
| `platform_admins` table or documentation | Concept was never documented or implemented; formally out of scope per DEC-015 |
| `docs/01_identity/ROLE_MODEL.md` | Decided upon (DEC-011) but not yet created; tracked in OQ-010; must be created before Phase 15 |

---

## Deprecation Wrapper Template

When executing the migration (OQ-015), use this wrapper for deprecated root files:

```markdown
# DEPRECATED

> This file has been deprecated as of 2026-04.
>
> **Canonical replacement:** `docs/<target/path/file.md>`
> **Reason:** <brief reason from remediation table above>
>
> This file is preserved for historical traceability. Do not edit.
> All future updates go to the canonical replacement.
```

---

## Outstanding Actions (Not Yet Executed)

The following actions are planned but not yet executed. Track via OQ-015.

- [ ] Create `docs/` directory hierarchy on disk
- [ ] Move canonical files to target paths
- [ ] Create deprecation wrappers for deprecated root files
- [ ] Merge `TECH_STACK_AWS.md` and `aws_foundation_plan.md` content into `TECHNICAL_ARCHITECTURE.md`
- [ ] Create `docs/00_overview/README.md`
- [ ] Create `docs/01_identity/ROLE_MODEL.md`
- [ ] Update cross-references in all moved files to use canonical paths
- [ ] Update root `README.md` to point to `docs/00_overview/README.md`
- [ ] Record completion in `PHASE_STATUS.md`