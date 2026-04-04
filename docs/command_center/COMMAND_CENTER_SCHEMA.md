# Wayfield Command Center — Schema Additions

## Source Authority
These tables extend the existing Wayfield schema defined in
`docs/03_schema/DATA_SCHEMA_FULL.md`. All existing tables remain unchanged.
New tables are prefixed with their domain for clarity.

---

## Platform Admin Identity

### admin_users
Platform-level administrator accounts. Entirely separate from the `users` table.

```sql
CREATE TABLE admin_users (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            ENUM('super_admin','admin','support','billing','readonly')
                    NOT NULL DEFAULT 'readonly',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    can_impersonate BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   DATETIME NULL,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    INDEX(is_active),
    UNIQUE(email)
);
```

Roles:
- `super_admin` — full platform access, can manage other admins
- `admin` — full access except managing other admins
- `support` — read all, manage support tickets, cannot touch billing or feature flags
- `billing` — read all, manage Stripe data and plan changes
- `readonly` — view-only across all platform sections

---

### admin_login_events
Security log for platform admin authentication attempts.

```sql
CREATE TABLE admin_login_events (
    id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_user_id  BIGINT UNSIGNED NULL,  -- null on failed attempts (unknown user)
    email_attempted VARCHAR(255) NOT NULL,
    outcome        ENUM('success','failed','locked') NOT NULL,
    ip_address     VARCHAR(45) NOT NULL,
    user_agent     VARCHAR(500) NULL,
    created_at     DATETIME NOT NULL,
    INDEX(admin_user_id),
    INDEX(ip_address),
    INDEX(outcome),
    INDEX(created_at)
);
```

---

### platform_audit_logs
All platform admin actions. Separate from tenant `audit_logs`.

```sql
CREATE TABLE platform_audit_logs (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_user_id   BIGINT UNSIGNED NULL FK -> admin_users.id,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(100) NULL,
    entity_id       BIGINT UNSIGNED NULL,
    organization_id BIGINT UNSIGNED NULL,  -- null for platform-level actions
    metadata_json   JSON NULL,
    ip_address      VARCHAR(45) NULL,
    created_at      DATETIME NOT NULL,
    INDEX(admin_user_id, created_at),
    INDEX(entity_type, entity_id),
    INDEX(organization_id, created_at),
    INDEX(action)
);
```

Example actions:
- `plan_changed` — org plan updated
- `feature_flag_overridden` — manual feature flag set
- `admin_user_created` — new platform admin added
- `impersonation_initiated` — (stub, future)
- `support_ticket_noted` — internal note added to ticket

---

## Stripe Billing

### stripe_customers
Links Wayfield organizations to Stripe customer records.

```sql
CREATE TABLE stripe_customers (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL UNIQUE FK -> organizations.id,
    stripe_id       VARCHAR(255) NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NULL,
    metadata_json   JSON NULL,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    INDEX(stripe_id)
);
```

---

### stripe_subscriptions
Mirrors Stripe subscription state locally for fast querying.

```sql
CREATE TABLE stripe_subscriptions (
    id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id      BIGINT UNSIGNED NOT NULL FK -> organizations.id,
    stripe_customer_id   VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_price_id      VARCHAR(255) NOT NULL,
    plan_code            ENUM('free','starter','pro','enterprise') NOT NULL,
    status               ENUM('active','trialing','past_due','canceled',
                              'incomplete','incomplete_expired','unpaid',
                              'paused') NOT NULL,
    trial_ends_at        DATETIME NULL,
    current_period_start DATETIME NOT NULL,
    current_period_end   DATETIME NOT NULL,
    canceled_at          DATETIME NULL,
    ended_at             DATETIME NULL,
    metadata_json        JSON NULL,
    created_at           DATETIME NOT NULL,
    updated_at           DATETIME NOT NULL,
    INDEX(organization_id),
    INDEX(status),
    INDEX(plan_code),
    INDEX(current_period_end)
);
```

---

### stripe_invoices
Invoice records synced from Stripe webhooks.

```sql
CREATE TABLE stripe_invoices (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id     BIGINT UNSIGNED NOT NULL FK -> organizations.id,
    stripe_invoice_id   VARCHAR(255) NOT NULL UNIQUE,
    stripe_customer_id  VARCHAR(255) NOT NULL,
    stripe_subscription_id VARCHAR(255) NULL,
    amount_due          INT NOT NULL,   -- cents
    amount_paid         INT NOT NULL DEFAULT 0,
    currency            VARCHAR(10) NOT NULL DEFAULT 'usd',
    status              ENUM('draft','open','paid','uncollectible','void') NOT NULL,
    invoice_pdf_url     VARCHAR(1000) NULL,
    period_start        DATETIME NOT NULL,
    period_end          DATETIME NOT NULL,
    paid_at             DATETIME NULL,
    due_date            DATETIME NULL,
    attempt_count       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    next_payment_attempt DATETIME NULL,
    created_at          DATETIME NOT NULL,
    updated_at          DATETIME NOT NULL,
    INDEX(organization_id),
    INDEX(status),
    INDEX(paid_at)
);
```

---

### stripe_events
Raw Stripe webhook event log. Source of truth for reconciliation.

```sql
CREATE TABLE stripe_events (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type      VARCHAR(100) NOT NULL,
    livemode        BOOLEAN NOT NULL DEFAULT FALSE,
    payload_json    JSON NOT NULL,
    processed_at    DATETIME NULL,
    error_message   TEXT NULL,
    created_at      DATETIME NOT NULL,
    INDEX(event_type),
    INDEX(processed_at),
    INDEX(livemode)
);
```

All Stripe webhooks are written here first, then processed asynchronously.
Idempotency: check `stripe_event_id` before processing. Already-processed
events are skipped silently.

---

## Automations

### automation_rules
Defines a trigger → condition → action automation.

```sql
CREATE TABLE automation_rules (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    trigger_type    VARCHAR(100) NOT NULL,
    -- Built-in values: invitation_pending_48h, session_starting_24h,
    --                  payment_failed, organization_inactive_30d,
    --                  attendance_anomaly
    conditions_json JSON NULL,
    -- Example: {"threshold": 0.5} for attendance_anomaly
    -- Example: {"plan_codes": ["free","starter"]} to scope by plan
    action_type     VARCHAR(100) NOT NULL,
    -- Built-in values: send_email, send_platform_notification,
    --                  create_audit_log, send_webhook
    action_config_json JSON NOT NULL,
    -- Example: {"template": "invitation_reminder", "subject": "Don't forget..."}
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    scope           ENUM('platform','organization') NOT NULL DEFAULT 'platform',
    organization_id BIGINT UNSIGNED NULL FK -> organizations.id,
    -- null = applies platform-wide; set to scope to one org
    run_interval_minutes INT UNSIGNED NOT NULL DEFAULT 60,
    last_evaluated_at DATETIME NULL,
    created_by_admin_id BIGINT UNSIGNED NOT NULL FK -> admin_users.id,
    created_at      DATETIME NOT NULL,
    updated_at      DATETIME NOT NULL,
    INDEX(trigger_type, is_active),
    INDEX(organization_id)
);
```

---

### automation_runs
Execution history for each automation rule firing.

```sql
CREATE TABLE automation_runs (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    automation_rule_id  BIGINT UNSIGNED NOT NULL FK -> automation_rules.id,
    triggered_at        DATETIME NOT NULL,
    entity_type         VARCHAR(100) NULL,  -- what triggered it (e.g. 'organization')
    entity_id           BIGINT UNSIGNED NULL,
    outcome             ENUM('success','failed','skipped') NOT NULL,
    actions_taken_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message       TEXT NULL,
    metadata_json       JSON NULL,
    created_at          DATETIME NOT NULL,
    INDEX(automation_rule_id, triggered_at),
    INDEX(outcome)
);
```

---

## Support (Crisp Integration)

### crisp_conversations
Local mirror of Crisp conversations for command center visibility.
Platform admins work in Crisp's own dashboard — this table is read-only
from Crisp's perspective, populated by Crisp webhooks.

```sql
CREATE TABLE crisp_conversations (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    crisp_session_id    VARCHAR(255) NOT NULL UNIQUE,
    organization_id     BIGINT UNSIGNED NULL FK -> organizations.id,
    user_id             BIGINT UNSIGNED NULL FK -> users.id,
    -- Matched by email from Crisp contact metadata
    status              ENUM('pending','ongoing','resolved','unresolved') NOT NULL,
    subject             VARCHAR(500) NULL,
    first_message_at    DATETIME NOT NULL,
    last_message_at     DATETIME NULL,
    first_reply_at      DATETIME NULL,
    resolved_at         DATETIME NULL,
    assigned_to         VARCHAR(255) NULL,  -- Crisp agent name
    tags_json           JSON NULL,
    message_count       INT UNSIGNED NOT NULL DEFAULT 0,
    created_at          DATETIME NOT NULL,
    updated_at          DATETIME NOT NULL,
    INDEX(organization_id),
    INDEX(user_id),
    INDEX(status),
    INDEX(last_message_at)
);
```

---

## Security and System Health

### login_events
Auth events for all tenant users. Written on every login attempt.

```sql
CREATE TABLE login_events (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT UNSIGNED NULL FK -> users.id,
    -- null on failed attempts
    email_attempted VARCHAR(255) NOT NULL,
    outcome     ENUM('success','failed','unverified','inactive') NOT NULL,
    platform    ENUM('web','ios','android','unknown') NOT NULL DEFAULT 'unknown',
    ip_address  VARCHAR(45) NOT NULL,
    user_agent  VARCHAR(500) NULL,
    created_at  DATETIME NOT NULL,
    INDEX(user_id),
    INDEX(ip_address, created_at),
    INDEX(outcome),
    INDEX(created_at)
);
```

---

### security_events
Suspicious or notable security events across the platform.

```sql
CREATE TABLE security_events (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    event_type      VARCHAR(100) NOT NULL,
    -- Examples: brute_force_attempt, token_reuse, unusual_location,
    --           rate_limit_exceeded, suspicious_pattern
    severity        ENUM('low','medium','high','critical') NOT NULL,
    user_id         BIGINT UNSIGNED NULL FK -> users.id,
    organization_id BIGINT UNSIGNED NULL FK -> organizations.id,
    ip_address      VARCHAR(45) NULL,
    description     TEXT NOT NULL,
    metadata_json   JSON NULL,
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at     DATETIME NULL,
    resolved_by_admin_id BIGINT UNSIGNED NULL FK -> admin_users.id,
    created_at      DATETIME NOT NULL,
    INDEX(event_type, severity),
    INDEX(user_id),
    INDEX(organization_id),
    INDEX(is_resolved, severity),
    INDEX(created_at)
);
```

---

### failed_jobs_log
Snapshot of failed queue jobs for command center visibility.
Laravel's `failed_jobs` table already exists — this is a summary view
populated by a listener on job failure events.

```sql
CREATE TABLE failed_jobs_log (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_uuid        CHAR(36) NOT NULL UNIQUE,
    queue           VARCHAR(100) NOT NULL,
    job_class       VARCHAR(255) NOT NULL,
    organization_id BIGINT UNSIGNED NULL,
    error_message   TEXT NOT NULL,
    failed_at       DATETIME NOT NULL,
    retried_at      DATETIME NULL,
    resolved_at     DATETIME NULL,
    INDEX(job_class),
    INDEX(queue),
    INDEX(failed_at),
    INDEX(resolved_at)
);
```

---

## Metrics (On-Demand + Aggregation Hooks)

### metric_snapshots
Pre-aggregated metric snapshots. Initially empty — populated by a
future scheduled command when on-demand queries become too slow.
Schema is ready now so the aggregation job can be added without
migration changes later.

```sql
CREATE TABLE metric_snapshots (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    metric_key      VARCHAR(100) NOT NULL,
    -- Examples: dau, wau, mau, check_in_rate, invite_acceptance_rate
    granularity     ENUM('daily','weekly','monthly') NOT NULL,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    value           DECIMAL(15,4) NOT NULL,
    organization_id BIGINT UNSIGNED NULL,
    -- null = platform-wide metric
    metadata_json   JSON NULL,
    computed_at     DATETIME NOT NULL,
    UNIQUE(metric_key, granularity, period_start, organization_id),
    INDEX(metric_key, period_start),
    INDEX(organization_id)
);
```

---

## Configuration

### platform_config
Key-value store for platform-level configuration. Replaces hardcoded values.

```sql
CREATE TABLE platform_config (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    config_key  VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    value_type  ENUM('string','integer','boolean','json') NOT NULL DEFAULT 'string',
    description TEXT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by_admin_id BIGINT UNSIGNED NULL FK -> admin_users.id,
    created_at  DATETIME NOT NULL,
    updated_at  DATETIME NOT NULL
);
```

Initial rows (seeded):
- `stripe_webhook_secret` (sensitive)
- `crisp_website_id`
- `crisp_webhook_secret` (sensitive)
- `platform_admin_session_timeout_hours` = 8
- `automation_evaluation_interval_minutes` = 5
- `security_brute_force_threshold` = 10

---

## Summary — All New Tables

| Table | Domain | Purpose |
|---|---|---|
| `admin_users` | Auth | Platform admin accounts |
| `admin_login_events` | Auth | Platform admin login log |
| `platform_audit_logs` | Audit | All platform admin actions |
| `stripe_customers` | Billing | Org → Stripe customer link |
| `stripe_subscriptions` | Billing | Subscription state mirror |
| `stripe_invoices` | Billing | Invoice records |
| `stripe_events` | Billing | Raw webhook event log |
| `automation_rules` | Automations | Rule definitions |
| `automation_runs` | Automations | Execution history |
| `crisp_conversations` | Support | Crisp conversation mirror |
| `login_events` | Security | Tenant user login events |
| `security_events` | Security | Suspicious activity log |
| `failed_jobs_log` | Health | Failed queue job summary |
| `metric_snapshots` | Metrics | Pre-aggregation hooks |
| `platform_config` | Config | Non-hardcoded platform config |

---

## Migration Order

Run in this order — foreign keys must exist before referencing tables:

```
1. admin_users
2. admin_login_events
3. platform_audit_logs
4. stripe_customers
5. stripe_subscriptions
6. stripe_invoices
7. stripe_events
8. automation_rules
9. automation_runs
10. crisp_conversations
11. login_events
12. security_events
13. failed_jobs_log
14. metric_snapshots
15. platform_config
```

Seed `platform_config` immediately after migration 15.
