# Command Center — Schema Reference
## docs/command_center/COMMAND_CENTER_SCHEMA.md

This document describes the database tables used by the Command Center platform.
All tables are in the same MySQL database as the tenant schema but are accessed
exclusively through the `auth:platform_admin` guard and `/api/platform/v1/*` routes.

Canonical field definitions: `docs/03_schema/DATA_SCHEMA_FULL.md` Part 2 (Tables 41–55).

---

## Table Overview

| Table | Purpose | Status |
|---|---|---|
| `admin_users` | Platform admin accounts | ✅ Active |
| `admin_login_events` | Login audit for admin accounts | ✅ Active |
| `platform_audit_logs` | Audit trail for all platform mutations | ✅ Active |
| `stripe_customers` | Stripe customer ID mirror | ✅ Active (data populated manually or via future webhook) |
| `stripe_subscriptions` | Stripe subscription state mirror | ✅ Active |
| `stripe_invoices` | Stripe invoice mirror | ✅ Active |
| `stripe_events` | Idempotent Stripe webhook event log | ✅ Active (webhook handler not wired) |
| `automation_rules` | Configurable automation trigger/action rules | ✅ Schema active |
| `automation_runs` | Execution log for automation runs | ✅ Schema active (engine not implemented) |
| `support_tickets` | Support ticket tracking | ✅ Schema active (Crisp integration skipped) |
| `support_ticket_messages` | Messages on support tickets | ✅ Schema active |
| `help_articles` | Platform documentation articles | ✅ Schema active |
| `platform_config` | Key-value platform configuration store | ✅ Active |
| `metric_snapshots` | Periodic platform/tenant metric snapshots | ✅ Active |
| `system_announcements` | Announcements displayed in tenant admin shell | ✅ Active |
| `platform_admins` | **DEPRECATED** — replaced by `admin_users` | ⚠️ Deprecated (migration not rolled back) |

---

## admin_users

The only admin identity table. Completely separate from the tenant `users` table.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `first_name` | VARCHAR(100) NOT NULL | |
| `last_name` | VARCHAR(100) NOT NULL | |
| `email` | VARCHAR(255) NOT NULL UNIQUE | |
| `password_hash` | VARCHAR(255) NOT NULL | Same naming convention as tenant `users` |
| `role` | ENUM | `super_admin`, `admin`, `support`, `billing`, `readonly` |
| `is_active` | BOOLEAN | default true |
| `last_login_at` | DATETIME nullable | |
| `created_at`, `updated_at` | DATETIME | |

**Constraint:** At least one `super_admin` must always be active.
Removing or demoting the last `super_admin` is rejected by the API.

---

## platform_audit_logs

Every mutation of tenant data by a platform admin writes here. No exceptions.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `admin_user_id` | BIGINT nullable FK → admin_users | |
| `organization_id` | BIGINT nullable | Not an FK — platform admins reference any org |
| `action` | VARCHAR(100) | e.g. `feature_flag_override`, `plan_change` |
| `entity_type` | VARCHAR(100) nullable | |
| `entity_id` | BIGINT nullable | |
| `old_value_json` | JSON nullable | Previous value for change tracking |
| `new_value_json` | JSON nullable | New value |
| `metadata_json` | JSON nullable | Additional context |
| `created_at` | DATETIME | |

---

## Stripe Mirror Tables

These tables mirror data from Stripe for fast querying without hitting the Stripe API.
They are populated by the Stripe webhook handler — **which is not yet implemented**
(see OPEN_QUESTIONS Q4). Until the webhook handler is wired, these tables may contain
stale or manually-populated data.

### stripe_customers
Links a Wayfield `organization_id` to a Stripe customer ID.

### stripe_subscriptions
Current subscription state per organisation.

### stripe_invoices
Invoice history per organisation.

### stripe_events
Idempotent event log. `UNIQUE(stripe_event_id)` prevents double-processing.

---

## automation_rules and automation_runs

`automation_rules` stores trigger/action configurations per organisation.
`automation_runs` records execution history.

**Important:** The automation execution engine (the scheduler or queue command
that evaluates and fires automation rules) is not yet implemented. These tables
can be populated via API (CRUD endpoints exist) but rules do not execute automatically.
See OPEN_QUESTIONS Q8.

---

## support_tickets and support_ticket_messages

Support ticket schema exists. Crisp integration was planned but skipped due to account
issues. The CC frontend support section will link to Freshdesk or Tawk.to rather than
managing tickets in-database. These tables may be unused in the initial CC frontend build.

---

## system_announcements

Announcements created by platform admins via the Command Center.
The tenant admin shell (`web/`) reads active announcements from
`GET /api/v1/system/announcements` and displays them in a banner.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `title` | VARCHAR(255) NOT NULL | |
| `message` | TEXT NOT NULL | |
| `is_active` | BOOLEAN | default true |
| `starts_at` | DATETIME nullable | Optional display window start |
| `ends_at` | DATETIME nullable | Optional display window end |
| `created_by_admin_user_id` | BIGINT nullable FK → admin_users | |
| `created_at`, `updated_at` | DATETIME | |

---

## platform_admins [DEPRECATED]

⚠️ **This table is deprecated.** It was created in an early migration and
subsequently replaced by `admin_users`. The migration has not been rolled back.

**Action required (AR-10):** Write and run a down migration to drop this table.
No code references `platform_admins` — the `AdminUser` model points to `admin_users`.

Until the down migration is run, both tables coexist in the schema.
Only `admin_users` is used. Ignore `platform_admins`.

---

## Data Flow: Tenant Data in the Command Center

Platform admins read tenant data (organisations, workshops, users, billing) through
the platform API endpoints. They do not query tenant tables directly through a
separate connection.

The platform API controllers read from the same tenant tables (e.g. `organizations`,
`subscriptions`, `workshops`) as the tenant API. The difference is:
- They are authorised by the `auth:platform_admin` guard
- They apply no single-tenant scope — they can read across all organisations
- Any mutation goes through explicitly defined platform actions and always
  writes to `platform_audit_logs`