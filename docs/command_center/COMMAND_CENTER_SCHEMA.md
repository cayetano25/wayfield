# Command Center — Schema Reference
## docs/command_center/COMMAND_CENTER_SCHEMA.md

> Canonical field definitions: `docs/03_schema/DATA_SCHEMA_FULL.md` Part 2 (Tables 41–55)
> This document is a focused reference for tables used exclusively by the Command Center.
> Do not duplicate tenant schema here — refer to DATA_SCHEMA_FULL.md for tenant tables.

---

## Table Status Overview

| Table | Purpose | Status |
|---|---|---|
| `admin_users` | Platform admin accounts and identity | ✅ Active |
| `admin_login_events` | Login audit trail for admin accounts | ✅ Active |
| `platform_audit_logs` | Immutable audit trail for all platform mutations | ✅ Active |
| `platform_config` | Key-value platform configuration store | ✅ Active |
| `system_announcements` | Announcements displayed in tenant admin shell | ✅ Active |
| `metric_snapshots` | Periodic platform and tenant metric snapshots | ✅ Active |
| `stripe_customers` | Stripe customer ID mirror per organisation | ✅ Active (webhook handler not wired — Q4) |
| `stripe_subscriptions` | Stripe subscription state mirror | ✅ Active (may be stale — Q4) |
| `stripe_invoices` | Stripe invoice history mirror | ✅ Active (may be stale — Q4) |
| `stripe_events` | Idempotent Stripe webhook event log | ✅ Active (handler not wired — Q4) |
| `automation_rules` | Per-organisation automation trigger/action configs | ✅ Schema active (engine not built — Q8) |
| `automation_runs` | Execution history for automation rules | ✅ Schema active (engine not built — Q8) |
| `support_tickets` | Support ticket tracking | ✅ Schema active (Crisp skipped; unused in CC-Web) |
| `support_ticket_messages` | Messages on support tickets | ✅ Schema active (unused in CC-Web) |
| `help_articles` | Platform documentation articles | ✅ Schema active |
| `security_events` | Security event log (login anomalies, rate limits, etc.) | ✅ Active |
| `platform_admins` | **DEPRECATED** — replaced by `admin_users` | ⚠️ Deprecated (AR-10: migration not rolled back) |

---

## admin_users

The only platform admin identity table. Completely separate from the tenant `users` table.
All CC authentication flows use this table exclusively.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK AUTO_INCREMENT | |
| `first_name` | VARCHAR(100) | NOT NULL | |
| `last_name` | VARCHAR(100) | NOT NULL | |
| `email` | VARCHAR(255) | NOT NULL UNIQUE | Login credential |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt |
| `role` | ENUM | NOT NULL | `super_admin`, `admin`, `support`, `billing`, `readonly` |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true | Inactive admins cannot log in |
| `last_login_at` | DATETIME | nullable | Updated on successful login |
| `created_at` | DATETIME | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL | |

**Critical constraints:**
- At least one `super_admin` with `is_active = true` must exist at all times
- The API rejects any mutation that would violate this constraint
- `platform_admins` (deprecated) must never be referenced — use only `admin_users`

---

## admin_login_events

Audit trail for platform admin login activity.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `admin_user_id` | BIGINT UNSIGNED | FK → admin_users.id |
| `ip_address` | VARCHAR(45) | IPv4 or IPv6 |
| `user_agent` | TEXT | nullable |
| `outcome` | ENUM | `success`, `failed`, `blocked` |
| `created_at` | DATETIME | |

---

## platform_audit_logs

**Every mutation of tenant or platform data by a platform admin writes here. No exceptions.**
This table is the immutable record of all platform admin actions.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK AUTO_INCREMENT |
| `admin_user_id` | BIGINT UNSIGNED | nullable FK → admin_users. Nullable to handle deleted admins |
| `organization_id` | BIGINT UNSIGNED | nullable. Not a FK — platform admins operate across any org |
| `action` | VARCHAR(100) | e.g. `feature_flag_override`, `plan_change`, `announcement_created` |
| `entity_type` | VARCHAR(100) | nullable. e.g. `organization`, `automation_rule` |
| `entity_id` | BIGINT UNSIGNED | nullable |
| `old_value_json` | JSON | nullable. Previous value for change tracking |
| `new_value_json` | JSON | nullable. New value after change |
| `metadata_json` | JSON | nullable. Additional context (e.g. `{ "feature_key": "analytics" }`) |
| `created_at` | DATETIME | NOT NULL |

**No `updated_at`** — audit log entries are immutable. Never update or delete rows.

The API service responsible for writing here: `PlatformAuditService::record()`

```php
PlatformAuditService::record(
    adminUser: $adminUser,
    action: 'feature_flag_override',
    entityType: 'organization',
    entityId: $organization->id,
    oldValue: $previousValue,
    newValue: $newValue,
    metadata: ['feature_key' => $featureKey]
);
```

---

## platform_config

Key-value store for platform-level configuration. Keys are fixed — no dynamic key creation.
Values are editable by `super_admin` only via the CC Settings screen.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `config_key` | VARCHAR(100) | NOT NULL UNIQUE |
| `config_value` | TEXT | nullable |
| `description` | TEXT | nullable. Human-readable description of the config key |
| `updated_by_admin_id` | BIGINT UNSIGNED | nullable FK → admin_users |
| `updated_at` | DATETIME | |

---

## system_announcements

Announcements published by platform admins. The tenant web admin (`web/`) reads active
announcements from `GET /api/v1/system/announcements` and displays them as banner alerts.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `title` | VARCHAR(255) | NOT NULL |
| `message` | TEXT | NOT NULL |
| `type` | ENUM | `info`, `warning`, `critical` |
| `is_active` | BOOLEAN | default true |
| `starts_at` | DATETIME | nullable. Optional display window start |
| `ends_at` | DATETIME | nullable. Optional display window end |
| `created_by_admin_user_id` | BIGINT UNSIGNED | nullable FK → admin_users |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

---

## metric_snapshots

Periodic snapshots of platform-wide and per-organisation metrics for historical trending.
Written by a scheduled job (not by platform admin action).

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `snapshot_type` | VARCHAR(100) | e.g. `platform_daily`, `organization_weekly` |
| `organization_id` | BIGINT UNSIGNED | nullable. null = platform-wide snapshot |
| `metric_data_json` | JSON | NOT NULL. Snapshot payload |
| `snapshotted_at` | DATETIME | NOT NULL |
| `created_at` | DATETIME | |

---

## Stripe Mirror Tables

These tables mirror data from Stripe for fast read access without hitting the Stripe API.

**⚠️ Important:** The Stripe webhook handler is not yet wired (OPEN_QUESTIONS Q4).
Until it is, these tables may contain stale or manually-populated data.
The CC frontend must display a clear staleness notice wherever this data is shown.

### stripe_customers
| Field | Notes |
|---|---|
| `id` | PK |
| `organization_id` | FK → organizations.id |
| `stripe_customer_id` | Stripe customer ID (e.g. `cus_xxx`) |
| `created_at`, `updated_at` | |

### stripe_subscriptions
| Field | Notes |
|---|---|
| `id` | PK |
| `organization_id` | FK → organizations.id |
| `stripe_subscription_id` | |
| `plan_code` | Maps to Wayfield plan: `free`, `starter`, `pro`, `enterprise` |
| `status` | `active`, `trialing`, `past_due`, `canceled`, `incomplete` |
| `current_period_start` | DATETIME |
| `current_period_end` | DATETIME |
| `trial_ends_at` | DATETIME nullable |
| `created_at`, `updated_at` | |

### stripe_invoices
| Field | Notes |
|---|---|
| `id` | PK |
| `organization_id` | FK → organizations.id |
| `stripe_invoice_id` | |
| `amount_due` | INT (cents) |
| `amount_paid` | INT (cents) |
| `currency` | VARCHAR(3) e.g. `usd` |
| `status` | `draft`, `open`, `paid`, `uncollectible`, `void` |
| `invoice_pdf_url` | nullable |
| `invoice_date` | DATETIME |
| `created_at`, `updated_at` | |

### stripe_events
Idempotent event log — `UNIQUE(stripe_event_id)` prevents double-processing.
| Field | Notes |
|---|---|
| `id` | PK |
| `stripe_event_id` | UNIQUE |
| `event_type` | e.g. `customer.subscription.updated` |
| `payload_json` | Full Stripe event payload |
| `processed_at` | nullable. null = received but not yet processed |
| `created_at` | |

---

## automation_rules

Per-organisation automation trigger/action configurations.

**⚠️ Important:** The automation execution engine is not yet implemented (OPEN_QUESTIONS Q8).
Rules created here will not execute automatically until the engine is built.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `organization_id` | BIGINT UNSIGNED | FK → organizations.id |
| `name` | VARCHAR(255) | NOT NULL |
| `trigger_type` | VARCHAR(100) | e.g. `workshop_published`, `participant_registered` |
| `trigger_conditions_json` | JSON | nullable. Conditions that must match for trigger to fire |
| `action_type` | VARCHAR(100) | e.g. `send_email`, `notify_leader` |
| `action_config_json` | JSON | nullable. Action-type-specific configuration |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true |
| `last_run_at` | DATETIME | nullable. Populated by execution engine when built |
| `created_at`, `updated_at` | DATETIME | |

---

## automation_runs

Execution log for automation rules. Currently empty — populated only when the
execution engine is built.

| Field | Notes |
|---|---|
| `id` | PK |
| `automation_rule_id` | FK → automation_rules.id |
| `triggered_at` | DATETIME |
| `completed_at` | DATETIME nullable |
| `outcome` | ENUM: `success`, `failed`, `skipped` |
| `error_message` | TEXT nullable |
| `created_at` | |

---

## security_events

Security event log for the platform. Populated by the API when anomalies are detected.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT UNSIGNED | PK |
| `organization_id` | BIGINT UNSIGNED | nullable FK → organizations.id |
| `user_id` | BIGINT UNSIGNED | nullable FK → users.id |
| `event_type` | VARCHAR(100) | e.g. `login_rate_limit`, `invalid_token_flood` |
| `severity` | ENUM | `low`, `medium`, `high`, `critical` |
| `description` | TEXT | nullable |
| `metadata_json` | JSON | nullable |
| `created_at` | DATETIME | NOT NULL |

---

## support_tickets and support_ticket_messages

These tables exist but the CC frontend **does not build a ticket UI** against them.
The Crisp integration was skipped. Support is handled via an external tool (Freshdesk).
These tables are reserved for a future direct integration phase.

---

## platform_admins [DEPRECATED — AR-10]

⚠️ **This table is deprecated.** It was created in an early migration and subsequently
replaced by `admin_users`. The migration has not been rolled back (tracked as AR-10).

**No code references `platform_admins`.** The `AdminUser` model maps to `admin_users`.
Until the down migration runs, both tables coexist in the database.
Ignore `platform_admins` entirely in all implementation work.
