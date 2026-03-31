# Wayfield Documentation Index

Wayfield is a production-bound multi-tenant SaaS platform for managing photography
workshops and creative events. This file is the navigational index for the full
documentation set.

---

## 1. File Registry

| File | Purpose | Classification |
|---|---|---|
| `CLAUDE.md` | Claude Code project memory: non-negotiable rules, tech stack, directory map, current phase | Project memory |
| `MASTER_PROMPT.md` | Full product definition, all critical rules, role definitions, brand, delivery expectations | **Constitutional — source of truth** |
| `README.md` | This file. Navigational index and hierarchy reference. | Derived index |
| `docs/01_product/MVP_SCOPE.md` | Defines MVP scope and what ships in Phases 2–4 | Product source of truth |
| `docs/01_product/PRICING_AND_TIERS.md` | Plan tiers (Free/Starter/Pro/Enterprise), per-tier feature entitlements, participant and workshop limits | Product source of truth |
| `docs/02_domain/IDENTITY_AND_AUTH.md` | User entity requirements, email/password auth, auth_methods model, social login readiness, 2FA schema, session management | Domain spec |
| `docs/02_domain/PERSON_AND_CONTACT_MODEL.md` | Rule that all real people require first_name + last_name; covers users, leaders, org contacts, participants | Domain spec |
| `docs/02_domain/MULTI_TENANT_MODEL.md` | Tenant isolation rules, cross-tenant access prohibition, data scoping requirements | Domain spec |
| `docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md` | Four conceptual roles and their permissions; quick-reference matrix; organizer→DB role mapping; phone/meeting link/address privacy rules | Domain spec — **source of truth for authorization** |
| `docs/02_domain/WORKSHOP_DOMAIN_MODEL.md` | Workshop types, status transitions, required fields, logistics model, default location fallback | Domain spec |
| `docs/02_domain/SESSION_AND_CAPACITY_MODEL.md` | Session fields, capacity rules (null=unlimited), delivery_type requirements, virtual URL enforcement, selection rules | Domain spec |
| `docs/02_domain/LEADER_SYSTEM.md` | Leader lifecycle: invitation flow, profile ownership, org/workshop/session associations, public visibility rules | Domain spec |
| `docs/02_domain/ATTENDANCE_AND_ROSTER_SYSTEM.md` | Attendance record structure, self-check-in, leader check-in, roster access by role, status transitions | Domain spec |
| `docs/02_domain/NOTIFICATIONS_AND_MESSAGING_SYSTEM.md` | Notification types, sender scope rules, leader messaging constraints (scope + time window), delivery channels, enforcement | Domain spec — contains hard enforcement rules |
| `docs/02_domain/SUBSCRIPTION_AND_FEATURE_GATING.md` | Plan-to-feature mapping, gateable feature list, backend vs UI enforcement rules | Domain spec |
| `docs/02_domain/OFFLINE_SYNC_STRATEGY.md` | Offline-available data, sync model (initial + incremental), conflict resolution for attendance, failure handling | Domain spec |
| `docs/03_schema/DATA_SCHEMA_FULL.md` | Complete relational schema: all 32 tables, fields, types, indexes, foreign keys, table-level rules | **Schema source of truth** |
| `docs/04_api/SERVICE_BOUNDARIES.md` | Logical service separation (Auth, Workshop, Session, Leader, Attendance, Notification, etc.) | Architecture spec |
| `docs/04_api/API_ROUTE_SPEC.md` | Complete HTTP API surface: all routes, request/response shapes, validation, authorization notes | **API source of truth** |
| `docs/05_architecture/TECHNICAL_ARCHITECTURE.md` | Full tech stack, AWS service selection, compute strategy, environment profiles, deployment direction | Architecture source of truth |
| `docs/05_architecture/MODULE_BOUNDARIES.md` | Laravel backend module structure (14 modules), ownership, dependencies, cross-module rules | Architecture spec |
| `docs/06_implementation/LARAVEL_IMPLEMENTATION_PLAN.md` | Laravel patterns, data layer strategy, serialization, queue, audit, and testing approach | Implementation guide |
| `docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md` | Phases 0–9 with goals, scope, deliverables, and exit criteria | Implementation guide — **source of truth for build sequence** |
| `docs/06_implementation/BUILD_SEQUENCE_CHECKLIST.md` | Task-level implementation checklist per phase | Derived checklist |
| `docs/06_implementation/PHASE_PROMPTS.md` | Claude Code prompts for each phase (0–9); instructs code generation within strict constraints | Implementation tool |
| `docs/07_testing/TESTING_AND_VALIDATION_STRATEGY.md` | Test categories, fixtures, high-risk scenarios, persona acceptance matrix, release gate criteria | Quality spec |

---

## 2. Retired Files

These files existed in earlier iterations. Their content was absorbed into the files above.

| Retired File | Absorbed Into |
|---|---|
| `PLAN.md` | `docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md` |
| `SCHEMA_SPEC.md` | `docs/03_schema/DATA_SCHEMA_FULL.md` |
| `TECH_STACK_AWS.md` | `docs/05_architecture/TECHNICAL_ARCHITECTURE.md` |
| `aws_foundation_plan.md` | `docs/05_architecture/TECHNICAL_ARCHITECTURE.md` |
| `permissions_matrix.md` | `docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md` |
| `mvp_and_phases.md` | `docs/01_product/MVP_SCOPE.md` |
| `pricing.md` | `docs/01_product/PRICING_AND_TIERS.md` |
| `IDENTITY_SYSTEM.md` | `docs/02_domain/IDENTITY_AND_AUTH.md` |
| `API_AND_SERVICE_BOUNDARIES.md` | `docs/04_api/SERVICE_BOUNDARIES.md` |

---

## 3. Source-of-Truth Hierarchy

When two files conflict, the higher tier wins. Never silently pick one — surface the conflict and resolve against the tier above.

```
Tier 1 — Constitutional
  MASTER_PROMPT.md
  └── Overrides everything. No exceptions.

Tier 2 — Product Definition
  docs/01_product/MVP_SCOPE.md
  docs/01_product/PRICING_AND_TIERS.md
  └── Override all spec and implementation files on scope and entitlement decisions.
      Do not override domain rules or schema structure.

Tier 3 — Schema Authority
  docs/03_schema/DATA_SCHEMA_FULL.md
  └── Overrides all domain spec files on field names, types, and table structure.
      When a domain file and the schema disagree on a field name, the schema wins.
      Exception: if the schema contradicts a MASTER_PROMPT.md behavioral rule,
      MASTER_PROMPT.md wins and the schema must be corrected.

Tier 4 — Domain Specs
  docs/02_domain/*.md
  └── Override API spec, architecture, and implementation files on behavioral rules,
      constraints, and privacy requirements. When two domain files conflict,
      resolve against MASTER_PROMPT.md — no domain file automatically overrides another.

Tier 5 — API Spec
  docs/04_api/API_ROUTE_SPEC.md
  └── Overrides implementation guides on route structure and request/response contracts.
      Does not override domain specs on authorization rules.

Tier 6 — Architecture Specs
  docs/05_architecture/*.md
  └── Override implementation guides on structural decisions.
      Do not override domain specs or schema.

Tier 7 — Implementation Guides
  docs/06_implementation/*.md
  └── Lowest authority. Must conform to all tiers above.
      When a phase prompt conflicts with a domain spec, the domain spec wins.

Tier 8 — Derived Artifacts
  README.md, docs/06_implementation/BUILD_SEQUENCE_CHECKLIST.md
  └── No independent authority. Must reflect their source documents.
```

### Enforcement Location Rule

When any file is ambiguous about backend vs UI enforcement, `MASTER_PROMPT.md` is
explicit: capacity enforcement, feature gating, and authorization are always enforced
in backend business rules first. UI controls are supplementary, never primary.

---

## 4. Open Issues (Resolved in This Revision)

The following contradictions were identified in the audit and resolved:

| Issue | Resolution |
|---|---|
| `SESSION_AND_CAPACITY_MODEL` used `start_time`/`end_time` | Fixed to `start_at`/`end_at` (schema authority) |
| `SESSION_AND_CAPACITY_MODEL` had `leader_id` FK on sessions | Fixed to reference `session_leaders` junction table |
| `WORKSHOP_DOMAIN_MODEL` used `public_visibility` | Fixed to `public_page_enabled` (schema authority) |
| `LEADER_SYSTEM` had `session_id` on `leader_invitations` | Removed; session assignment handled post-acceptance via `session_leaders` |
| "Organizer" role had no DB mapping | Explicit mapping table added to `PERMISSIONS_AND_PRIVACY_MODEL` |
| Three conflicting auth token mechanisms | Sanctum is the implementation choice; `user_sessions` table is the audit/lifecycle record; see `IDENTITY_AND_AUTH.md` |
| `TECH_STACK_AWS.md` and `aws_foundation_plan.md` were stubs | Absorbed into `TECHNICAL_ARCHITECTURE.md` |
| `SCHEMA_SPEC.md` was a partial duplicate | Absorbed into `DATA_SCHEMA_FULL.md` |
| `PLAN.md` was an incomplete stub | Absorbed into `PHASED_IMPLEMENTATION_PLAN.md` |
| `PHASE_PROMPTS.md` contained only Phase 5 | Replaced with full Phase 0–9 version |

---

## 5. Known Open Questions (Not Yet Resolved)

These require a deliberate product decision before implementation:

| Question | Relevant File | Impact |
|---|---|---|
| Participant phone number storage field | `DATA_SCHEMA_FULL.md` users table | Phone privacy rules govern a field that doesn't exist yet |
| Join code format, length, character set | `WORKSHOP_DOMAIN_MODEL.md` | `GenerateJoinCodeService` has no contract |
| Token expiry durations (invitation, password reset, email verification) | `IDENTITY_AND_AUTH.md` | Security compliance requirement |
| Public workshop slug generation rules | `DATA_SCHEMA_FULL.md` `public_slug` field | Public page URLs have no generation spec |
| `hybrid` virtual participation flag | `SESSION_AND_CAPACITY_MODEL.md` | No field determines which hybrid sessions require `meeting_url` |
| Leader messaging: Free plan vs Starter gating | `PRICING_AND_TIERS.md` | "Advanced notifications" is undefined; basic leader messaging scope is ambiguous |
| Multi-track support gating | `PRICING_AND_TIERS.md` | MASTER_PROMPT flags this as "depending on final pricing decision" |
| `delivery_scope = 'custom'` implementation | `NOTIFICATIONS_AND_MESSAGING_SYSTEM.md` | Enum value has no data model or API surface |
| Soft delete strategy | All domain tables | Deletion behavior and cascade effects are undefined |
| Workshop-level participant capacity field | `DATA_SCHEMA_FULL.md` workshops table | Plan limits reference participant counts with no schema home |
| Waitlist promotion mechanics | `SUBSCRIPTION_AND_FEATURE_GATING.md` | Enum value exists but state has no exit path |
| `audit_logs.metadata_json` schema per event type | `DATA_SCHEMA_FULL.md` | Each service will invent its own format |
| Concurrent capacity enforcement strategy | `SESSION_AND_CAPACITY_MODEL.md` | High-risk overbooking scenario flagged but unmitigated |
