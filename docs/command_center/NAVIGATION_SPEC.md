# Command Center — Navigation Specification
## docs/command_center/NAVIGATION_SPEC.md

> **Status:** Specification only. The Command Center frontend has not been built.
> This document defines the navigation structure to be implemented in CC-Web Phases 1–4.

---

## Shell Structure

The Command Center uses a **persistent dark sidebar shell** on all authenticated screens.
This visually distinguishes it from the tenant web admin (`web/`) which uses a lighter theme.
┌─────────────────────────────────────────────────────────────┐
│  COMMAND CENTER          [Admin Name] [Role badge] [Logout] │  ← Top bar
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  SIDEBAR     │  MAIN CONTENT AREA                          │
│  (dark)      │                                              │
│              │                                              │
│  Nav items   │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘

The top bar shows the admin's name, their role badge, and a logout button.
The sidebar is always visible on authenticated screens.

---

## Sidebar Navigation Items

Listed in display order. Role visibility noted where an item is restricted.

| Item | Icon | Route | Visible to | Built in |
|---|---|---|---|---|
| Overview | Dashboard | `/` | All roles | CC-Web 1 |
| Organisations | Building | `/organizations` | All except `readonly` (read only) | CC-Web 2 |
| Users | Users | `/users` | `super_admin`, `admin`, `support` | CC-Web 3 |
| Financials | CreditCard | `/financials` | `super_admin`, `billing` | CC-Web 3 |
| Support | Ticket | `/support` | `super_admin`, `admin`, `support` | CC-Web 3 |
| Automations | Zap | `/automations` | `super_admin`, `admin` | CC-Web 4 |
| Security | Shield | `/security` | `super_admin`, `admin`, `support` | CC-Web 4 |
| Audit Log | ClipboardList | `/audit` | `super_admin`, `admin` | CC-Web 4 |
| Settings | Settings | `/settings` | `super_admin` | CC-Web 4 |

**`readonly` role**: sees Overview and Organisations (read-only) only.
All mutation controls are hidden or disabled for `readonly`.

---

## Screen Inventory by Phase

### CC-Web Phase 1 — Auth, Shell, Overview

| Screen | Route | Description |
|---|---|---|
| Login | `/login` | Dark-themed login form. Calls `POST /api/platform/v1/auth/login`. No registration flow — admin accounts are created by `super_admin`. |
| Overview Dashboard | `/` | Platform health metrics: total organisations by plan, MRR, active users (30-day), recent signups. Stat cards with trends. Plan distribution donut chart. Recent audit events list. |

### CC-Web Phase 2 — Organisation Management

| Screen | Route | Description |
|---|---|---|
| Organisations List | `/organizations` | Filterable table: name, plan badge, status, participant count, workshop count, last active. Search by name or email. Filter by plan and status. |
| Organisation Detail | `/organizations/{id}` | Tabs: Overview · Billing · Feature Flags · Usage · Audit. Overview shows contact info, plan, workshop count. |
| Organisation > Billing tab | `/organizations/{id}?tab=billing` | Plan display, invoice list. Plan change modal (billing/super_admin only). Link to Stripe. |
| Organisation > Feature Flags tab | `/organizations/{id}?tab=flags` | List of feature flags with toggle switches. Each toggle shows source (plan_default vs manual_override). Toggle writes audit log. Admin/super_admin only. |
| Organisation > Usage tab | `/organizations/{id}?tab=usage` | Workshop count vs limit, participant count vs limit, manager count vs limit. Usage bars with thresholds. |

### CC-Web Phase 3 — Users, Financials, Support

| Screen | Route | Description |
|---|---|---|
| Users List | `/users` | All tenant users. Search by email. Filterable by org. Table: name, email, orgs (count), last login, verified status. |
| User Detail (slide-over) | (triggered from list) | User detail slide-over: profile, org memberships with roles, login history (last 10 events from `login_events`). |
| Financials Overview | `/financials` | MRR and ARR summary cards. Subscription count by plan and status. Invoice list (from `stripe_invoices`). Note: data accuracy depends on Stripe webhook wiring (Q4). |
| Support | `/support` | Links to external support tool (Freshdesk). Ticket schema exists in DB but CC frontend will link externally rather than building a ticket UI. |

### CC-Web Phase 4 — Automations, Security, Audit, Settings

| Screen | Route | Description |
|---|---|---|
| Automations List | `/automations` | List of automation rules across all organisations. Filter by org, trigger type, status. Note: rules exist but the execution engine is not implemented (Q8). |
| Automation Detail / Create | `/automations/new`, `/automations/{id}` | Rule CRUD: trigger selector, action selector, condition editor, active toggle. |
| Security Events | `/security` | `security_events` table display. Filter by severity, event type, date. Colour-coded severity badges. |
| Audit Log | `/audit` | `platform_audit_logs` table. Filter by admin user, organisation, action, date range. Expandable metadata column. |
| Settings | `/settings` | Platform config key-value editor. Admin user management (list, invite, role change, deactivate). Super_admin only. Last-super-admin guard active. |

---

## Route Guards

All routes except `/login` require authentication via the platform admin token.

On any request to an authenticated route:
1. Check for platform admin token in storage
2. If absent: redirect to `/login`
3. If present: verify against `GET /api/platform/v1/me` (or decoded from JWT if applicable)
4. If 401: clear token, redirect to `/login`
5. If valid: render the screen

Role guards for specific screens:
- `/settings`: `super_admin` only — redirect `admin` and below to `/`
- `/financials`: `super_admin`, `billing` — redirect others to `/`
- `/users`: `super_admin`, `admin`, `support` — redirect `billing` and `readonly` to `/`

---

## Empty and Loading States

Every list screen must handle:
- **Loading:** skeleton rows while data fetches
- **Empty:** clear empty state message with context
- **Error:** error banner with retry action

Every mutation (toggle, plan change, role change) must show:
- **Optimistic UI** is acceptable but must roll back on API error
- **Confirmation toast** on success
- **Error toast** on failure with the error message from the API

---

## Design Conventions

- **Colour scheme:** dark sidebar (`#1a1a2e` or similar), light main area
- **Typography:** same brand fonts as tenant admin (Sora headings, Plus Jakarta Sans body)
- **Role badges:**
  - `super_admin`: red/coral
  - `admin`: blue
  - `support`: purple
  - `billing`: amber/orange
  - `readonly`: grey
- **Plan badges:** matches tenant admin plan colour conventions
- **Mutation actions:** always require explicit confirmation for destructive operations
  (plan downgrades, feature flag removal, admin deactivation)