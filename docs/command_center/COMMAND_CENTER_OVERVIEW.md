# Command Center — Overview
## docs/command_center/COMMAND_CENTER_OVERVIEW.md

> **Backend API:** Complete (CC-API Phases 1–5)
> **Frontend app (`command/`):** Scaffolded only — no domain screens built

---

## What Is the Command Center

The Command Center is a separate internal web application for Wayfield platform
administrators — employees of Wayfield itself. It is not accessible to tenant
organisations or their users.

It provides:
- A read view across all tenant organisations and their usage data
- Billing management and Stripe subscription control
- Feature flag overrides per organisation
- Platform-level automation rule management
- Support ticket oversight
- System announcement publishing
- Audit log access for platform admin mutations

The Command Center is a **Wayfield-internal tool only**. It is not a white-label
admin panel. Tenant organisations use the web admin at `web/` for their own management.

---

## Architecture Separation

The Command Center has complete architectural isolation from the tenant-facing system.

| Concern | Tenant System | Command Center |
|---|---|---|
| User table | `users` | `admin_users` |
| Auth guard | `auth:sanctum` | `auth:platform_admin` |
| Token type | `users` Sanctum token | `admin_users` Sanctum token |
| Route prefix | `/api/v1/*` | `/api/platform/v1/*` |
| Frontend app | `web/` (Next.js) | `command/` (Next.js, separate app) |
| Audit log | `audit_logs` (tenant events) | `platform_audit_logs` (platform mutations) |

**A tenant token is always rejected on platform routes.**
**A platform admin token is always rejected on tenant routes.**
This is enforced by middleware on every route, not by convention.

---

## What Platform Admins Can Do

Platform admins can **read** all tenant data across organisations for support
and oversight purposes.

Platform admins can **only mutate** tenant data through the following explicitly
defined actions:
- Feature flag overrides: `POST /api/platform/v1/organizations/{org}/feature-flags`
- Plan changes: `POST /api/platform/v1/organizations/{org}/billing/plan`
- System announcements: create, update, delete via platform announcement endpoints

Every platform admin mutation writes to `platform_audit_logs`. No exceptions.

---

## Platform Admin Roles

Stored in `admin_users.role`. Completely separate from tenant `organization_users.role`.

| Role | Description |
|---|---|
| `super_admin` | Full access including managing other admin users |
| `admin` | Full platform access; cannot manage `super_admin` accounts |
| `support` | Read all tenant data, manage support tickets; no billing or feature flags |
| `billing` | Read all, manage billing and plan changes; no feature flags or admin management |
| `readonly` | View-only across all platform sections |

There must always be at least one active `super_admin`. The last-super-admin guard
prevents removal or demotion of the final `super_admin`.

---

## Current Build State

### API Backend — ✅ Complete

All five CC-API phases are complete. The following capabilities exist as working
API endpoints:
- Platform admin login and session management
- Organisation list with usage metrics and billing data
- Organisation detail with plan and feature flag management
- User list with login history
- Stripe billing data (mirror tables — webhook handler not wired)
- Automation rules CRUD
- Support ticket oversight (Crisp skipped; placeholder only)
- Feature flag management with platform audit logging
- Platform admin user management with last-super-admin guard
- Platform audit log retrieval
- System announcements CRUD

### Frontend Application — ❌ Not Started

The `command/` Next.js application exists in the monorepo but contains only:
- `app/layout.tsx` — root layout
- `app/page.tsx` — root page

No auth flow, no navigation shell, no dashboard, no domain screens have been built.
The frontend build is planned across four phases (CC-Web 1–4).
See `COMMAND_CENTER_PHASE_PROMPTS.md` for the build prompts.

---

## Known Limitations (Not Bugs)

| Limitation | Status |
|---|---|
| Stripe webhook handler | Tables exist; no active handler. Stripe data is not currently being mirrored in real time. See OPEN_QUESTIONS Q4. |
| Automation execution engine | Automation rules can be created via API but no scheduler or runner exists to execute them. See OPEN_QUESTIONS Q8. |
| Crisp integration | `crisp_conversations` table exists as a placeholder. No Crisp webhook handler is wired. Support section in the CC frontend will link to Freshdesk or similar. |
| `platform_admins` table | Deprecated and replaced by `admin_users`. The migration has not been rolled back. AR-10 tracks the cleanup. |