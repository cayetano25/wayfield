# Wayfield — Claude Code Project Memory

Wayfield is a production-bound, multi-tenant SaaS platform for managing photography
workshops and creative events. Laravel API backend · MySQL · Expo/React Native mobile ·
Next.js web admin · AWS infrastructure.

> Constitutional authority: @MASTER_PROMPT.md
> When files conflict, the hierarchy in README.md Section 3 resolves the conflict.

---

## Tech Stack

| Layer          | Technology                              |
|----------------|-----------------------------------------|
| Backend API    | Laravel (latest stable)                 |
| Auth tokens    | Laravel Sanctum                         |
| Database       | MySQL (AWS RDS)                         |
| Mobile         | Expo / React Native (offline-first)     |
| Web Admin      | Next.js                                 |
| Email          | AWS SES                                 |
| Queues         | AWS SQS / Laravel queue workers         |
| File storage   | AWS S3                                  |
| CDN            | CloudFront                              |
| Push           | Firebase Cloud Messaging / Expo Push    |
| Monitoring     | CloudWatch + Sentry                     |
| CI/CD          | GitHub Actions                          |

---

## Non-Negotiable Rules

### Identity and People
- `first_name` and `last_name` are REQUIRED on every real-person entity. Never use a single `name` field.
- Primary auth is email + password across web and mobile. No exceptions.
- Social login (Google, Facebook) is additive schema scaffolding — never replaces core auth.
- 2FA tables must exist and be schema-ready even if not yet activated.

### Multi-Tenancy
- Every protected resource must be scoped by `organization_id`.
- Cross-tenant data leakage is a critical failure. Enforce in DB queries, policies, and API middleware — never UI alone.

### Role Mapping (Conceptual → DB)
The permission model uses conceptual roles. Their DB mappings in `organization_users.role`:
- **Organizer** = `owner` or `admin`
- **Staff** = `staff` (limited: workshop/session view, attendance management, no billing)
- **Billing Admin** = `billing_admin` (billing actions only)
- See @docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md for the full matrix.

### Capacity
- `capacity = NULL` means unlimited. NEVER treat null as zero.
- When capacity is set, enforce it in backend business logic with database-level locking. Never UI only.
- Race conditions on simultaneous session selection MUST be handled at the DB layer.

### Virtual Sessions
- `delivery_type = virtual` or `hybrid` with virtual participation requires `meeting_url` before publishing.
- Meeting URLs are NEVER returned in fully public workshop endpoints.
- Participant-facing interfaces must show a "Join Meeting" action for virtual/hybrid sessions.

### Leader Permissions
- Leaders may ONLY access rosters for sessions they are explicitly assigned to.
- Leaders may ONLY message participants in their assigned sessions.
- Messaging time window: 4 hours before `session.start_at` (workshop timezone) through 2 hours after `session.end_at`.
- Backend enforcement of messaging window is MANDATORY. UI controls are supplementary.
- ALL leader notifications must produce an `audit_logs` record.

### Privacy
- Participant phone numbers: visible ONLY to assigned leaders and org `owner`/`admin` roles.
- Leader full address: private. Public APIs expose only `city` and `state_or_region`.
- Active meeting links: NEVER in public workshop endpoints by default.

### Feature Gating
- Enforce plan limits at the API/backend layer. Never UI alone.
- See @docs/01_product/PRICING_AND_TIERS.md for plan-to-feature mapping.

### Serialization
- Use role-aware API Resource classes. Never one universal serializer for all audiences.
- Public, Organizer, Participant, and Leader resource classes are separate.

---

## Laravel Conventions
- Thin controllers: validate → authorize → dispatch service/action → return resource.
- Business logic lives in Action or Service classes under `app/Domain/`.
- Authorization via Policies. Never rely on route visibility alone.
- Form Request classes for all input validation.
- Queue all notification delivery (email, push, in-app). Never synchronous.
- Write `AuditLogService::record()` calls from services, not controllers.

---

## Directory Map

```
CLAUDE.md                          ← This file (project memory)
MASTER_PROMPT.md                   ← Constitutional source of truth
README.md                          ← Full documentation index
api/                               ← Laravel backend API
CLAUDE.md                          ← Laravel-specific instructions
app/ routes/ database/ tests/
web/                               ← Next.js web admin + public pages
CLAUDE.md                          ← Next.js-specific instructions
mobile/                            ← Expo React Native mobile app
CLAUDE.md                          ← Expo-specific instructions
docs/                              ← All specs and blueprints
  01_product/
    MVP_SCOPE.md                   ← What ships in MVP vs later phases
    PRICING_AND_TIERS.md           ← Plan tiers and feature entitlements
  02_domain/                       ← Domain specs (what the system does)
    IDENTITY_AND_AUTH.md
    PERSON_AND_CONTACT_MODEL.md
    MULTI_TENANT_MODEL.md
    PERMISSIONS_AND_PRIVACY_MODEL.md
    WORKSHOP_DOMAIN_MODEL.md
    SESSION_AND_CAPACITY_MODEL.md
    LEADER_SYSTEM.md
    ATTENDANCE_AND_ROSTER_SYSTEM.md
    NOTIFICATIONS_AND_MESSAGING_SYSTEM.md
    SUBSCRIPTION_AND_FEATURE_GATING.md
    OFFLINE_SYNC_STRATEGY.md
  03_schema/
    DATA_SCHEMA_FULL.md            ← Canonical schema. Field names here override domain files.
  04_api/
    SERVICE_BOUNDARIES.md
    API_ROUTE_SPEC.md              ← Complete HTTP API surface
  05_architecture/
    TECHNICAL_ARCHITECTURE.md
    MODULE_BOUNDARIES.md           ← Laravel module structure
  06_implementation/
    LARAVEL_IMPLEMENTATION_PLAN.md
    PHASED_IMPLEMENTATION_PLAN.md  ← Phase 0–9 build plan
    BUILD_SEQUENCE_CHECKLIST.md    ← Task-level progress tracker
    PHASE_PROMPTS.md               ← Claude Code prompts for each phase
  07_testing/
    TESTING_AND_VALIDATION_STRATEGY.md
```

---

## Current Build Phase

Phase 0 — Architecture and Project Setup (in progress)
Working directory: api/

See @docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md for full scope and exit criteria.
Track progress in @docs/06_implementation/BUILD_SEQUENCE_CHECKLIST.md.
Use phase prompts from @docs/06_implementation/PHASE_PROMPTS.md to start each phase.
