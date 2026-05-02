# Command Center — Overview
## docs/command_center/COMMAND_CENTER_OVERVIEW.md

> **Backend API:** ✅ Complete — CC-API Phases 1–5 implemented
> **Frontend app (`command/`):** ❌ Not started — CC-Web Phases 1–4 to be built
>
> This document is the canonical entry point for all Command Center work.
> Read it before reading any other CC document.

---

## What Is the Command Center

The Command Center is a **separate internal web application** for Wayfield platform
administrators — employees of Wayfield itself. It is not accessible to tenant
organisations or their users under any circumstances.

It provides:
- Full observability across all tenant organisations and their usage
- Billing management and Stripe subscription control per organisation
- Feature flag overrides per organisation (with full audit trail)
- Platform-level automation rule management (engine not yet implemented)
- Support ticket oversight via external helpdesk integration
- System announcement publishing (displayed in tenant web admin shell)
- Complete audit log access for all platform admin mutations
- Platform admin user management with role-based access control

The Command Center is a **Wayfield-internal tool only**. It is not a white-label
admin panel, not a customer-facing portal, and not an extension of the tenant
web admin (`web/`). These are two completely separate applications.

---

## Architectural Isolation

The Command Center is completely isolated from the tenant-facing system at every layer.

| Concern | Tenant System | Command Center |
|---|---|---|
| User identity table | `users` | `admin_users` |
| Auth guard name | `auth:sanctum` | `auth:platform_admin` |
| Token type | `users` Sanctum token | `admin_users` Sanctum token |
| Route prefix | `/api/v1/*` | `/api/platform/v1/*` |
| Route file | `routes/api.php` | `routes/platform.php` |
| Frontend app | `web/` (Next.js) | `command/` (Next.js, separate app) |
| Audit log table | `audit_logs` (tenant events) | `platform_audit_logs` (platform mutations) |
| Token storage key | `wayfield_token` (or equivalent) | `cc_platform_token` |
| API client base URL | `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_PLATFORM_API_URL` |

**Hard rule: A tenant token is always rejected on platform routes.**
**Hard rule: A platform admin token is always rejected on tenant routes.**

These rules are enforced by middleware on every single route. They are not conventions
or guidelines — they are enforced at the HTTP layer with no exceptions.

---

## Platform Admin Roles

Stored in `admin_users.role`. Completely separate from tenant `organization_users.role`.
These roles determine what UI elements render and what API actions are permitted.

| Role | Description |
|---|---|
| `super_admin` | Full access including managing other admin user accounts |
| `admin` | Full platform access; cannot manage `super_admin` accounts |
| `support` | Read all tenant data; manage support tickets; no billing/feature flags |
| `billing` | Read all; manage billing and plan changes; no feature flags or admin management |
| `readonly` | View-only across all platform sections; no mutations of any kind |

**Last-super-admin constraint:** There must always be at least one active `super_admin`.
The API rejects any action that would remove or demote the final `super_admin`.
The UI must surface this constraint clearly before the admin attempts the action.

---

## What Platform Admins Can Read

Platform admins can **read all tenant data** across all organisations for support
and oversight purposes. This includes:
- All organisations and their users, workshops, sessions, registrations
- Billing data (from Stripe mirror tables)
- Feature flag states per organisation
- Login event history for any tenant user
- Security events
- Automation rule configurations

---

## What Platform Admins Can Mutate

Platform admins can **only mutate tenant data** through the following explicitly defined
actions. Every mutation writes to `platform_audit_logs` with no exceptions.

| Mutation | Endpoint | Roles Permitted |
|---|---|---|
| Change organisation plan | `POST /api/platform/v1/organizations/{org}/billing/plan` | `super_admin`, `billing` |
| Override feature flag | `POST /api/platform/v1/organizations/{org}/feature-flags` | `super_admin`, `admin` |
| Create/update/delete system announcement | announcement endpoints | `super_admin`, `admin` |
| Create/update automation rule | automation endpoints | `super_admin`, `admin` |
| Manage admin users | admin user endpoints | `super_admin` only |
| Edit platform config | config endpoints | `super_admin` only |

No other mutations to tenant data are permitted.

---

## Current Build State

### API Backend — ✅ Complete

All five CC-API phases are implemented and operational. The following capabilities
exist as working API endpoints:

- Platform admin login, logout, and session management
- `GET /api/platform/v1/me` — authenticated admin profile
- Organisation list with search, filter, usage metrics, and billing data
- Organisation detail with plan, feature flag management, and usage
- User list with email search
- User detail with organisation memberships and login history
- Stripe billing data (mirror tables — webhook handler not yet wired, see Known Limitations)
- Automation rules CRUD
- Security events retrieval
- Feature flag management with audit logging
- Platform admin user management with last-super-admin guard
- Platform audit log retrieval with filtering
- System announcements CRUD
- Platform config key-value read/write

### Frontend Application — ❌ Not Started

The `command/` Next.js application exists in the monorepo but contains only:
- `app/layout.tsx` — root layout (empty)
- `app/page.tsx` — root page (empty)

No auth flow, no navigation shell, no dashboard, no domain screens have been built.
The full frontend build is planned across four phases (CC-Web 1–4).
See `COMMAND_CENTER_PHASE_PROMPTS.md` for the complete Claude Code prompts.

---

## Known Limitations (Canonical — Not Bugs)

These are known gaps in the current implementation. They are not bugs.
They are tracked and documented. The CC frontend must acknowledge them visually
where relevant.

| ID | Limitation | Impact | Reference |
|---|---|---|---|
| Q4 | Stripe webhook handler not wired | Billing mirror tables exist but may be stale | OPEN_QUESTIONS Q4 |
| Q8 | Automation execution engine not implemented | Rules can be created but do not execute | OPEN_QUESTIONS Q8 |
| — | Crisp integration skipped | `crisp_conversations` table is a placeholder; support links externally | — |
| AR-10 | `platform_admins` table deprecated, migration not rolled back | Both tables coexist; only `admin_users` is used | AR-10 |
| — | AI-powered operations (daily brief, onboarding nudges) | Not yet designed or implemented; planned for a future CC phase | — |

---

## File Map — Command Center Documentation

All CC documentation lives in `docs/command_center/`.

| File | Purpose |
|---|---|
| `COMMAND_CENTER_OVERVIEW.md` | This file — entry point and current state |
| `COMMAND_CENTER_SCHEMA.md` | Database table reference for all CC tables |
| `NAVIGATION_SPEC.md` | Canonical navigation structure, routes, role visibility |
| `COMMAND_CENTER_IMPLEMENTATION_GUIDE.md` | Tech conventions, auth flow, API client, build sequence |
| `COMMAND_CENTER_PHASE_PROMPTS.md` | Full Claude Code prompts for CC-Web Phases 1–4 |
