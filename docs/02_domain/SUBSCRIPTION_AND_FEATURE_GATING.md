# Subscription and Feature Gating Specification
## docs/02_domain/SUBSCRIPTION_AND_FEATURE_GATING.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
**Specific plan limits and feature entitlements:** `docs/01_product/PRICING_AND_TIERS.md`
is the authoritative source for what each plan includes. This document defines the
enforcement model only. Do not duplicate or invent plan limits here.

---

## Core Rule

**Participants are always free.** Individual participants never pay. They may join
any number of workshops without cost.

**Organisations pay.** Subscription plans apply to organisations, not to individual
users. The organisation's plan determines which features are available to all members
of that organisation.

---

## Plan Tiers

Four tiers exist: **Free**, **Starter**, **Pro**, **Enterprise**.

For specific limits (workshop counts, participant caps, manager limits) and the exact
feature set of each plan, see `docs/01_product/PRICING_AND_TIERS.md`.

---

## Feature Gating Enforcement

Feature limits must be enforced at the **API/backend layer**. UI may reflect
limits, but UI enforcement alone is never sufficient — it is always bypassed by
direct API calls.

**Enforcement mechanism:** `EnforceFeatureGateService` is the single enforcement
point for plan-based limits. It is called from Action classes before any
plan-gated mutation proceeds.

**Gated actions are blocked** by throwing `PlanLimitExceededException`
(HTTP 403) with a structured error response:
```json
{
  "error": "plan_limit_exceeded",
  "limit_type": "workshops",
  "current_plan": "free",
  "required_plan": "starter"
}
```

---

## Feature Flag System

Beyond hard plan limits, individual features may be toggled per-organisation via the
`feature_flags` table.

| Field | Type | Notes |
|---|---|---|
| `organization_id` | BIGINT FK | |
| `feature_key` | VARCHAR | e.g. `leader_notifications`, `analytics`, `api_access` |
| `is_enabled` | BOOLEAN | |
| `source` | ENUM | `plan_default`, `manual_override` |

`ResolveOrganizationEntitlementsService` resolves the effective feature set for an
organisation by combining the plan defaults with any manual overrides.

**Manual overrides:**
- May only be set by organisation `owner` role users (or by platform admins via
  the Command Center).
- Every manual override writes an `audit_logs` entry with the previous value.
- This supports giving a Free plan organisation temporary access to a Pro feature
  for testing or support purposes.

---

## Leader Messaging Plan Gate

Leader-to-participant notifications require **Starter plan or higher**.

This plan gate controls access to the feature. The leader messaging constraints
(scope, time window, session assignment) always apply regardless of plan — the
constraints are not configurable and cannot be loosened by any plan or override.

See `docs/02_domain/ROLE_MODEL.md` Section 3 for the canonical constraint definition.

---

## Gateable Feature Categories

The following categories of features are plan-gated. Specific assignments to plans
are defined in `docs/01_product/PRICING_AND_TIERS.md`:

- **Workshop and participant volume** — maximum active workshops, maximum participants
  per workshop, maximum organisation managers
- **Leader notifications** — leader-to-participant messaging
- **Analytics and reporting** — attendance summaries, advanced reporting, registration trends
- **Automation** — reminder automation, scheduled notifications
- **API and webhooks** — external API key access, outbound webhooks
- **Advanced permissions** — granular role customisation (future)
- **Enterprise features** — SSO, MFA, white-label, governance (Enterprise tier)

---

## Capacity vs Plan Gating

`capacity = NULL` on a session means unlimited participant enrollment for that session.
This is a session-level configuration choice, not a plan-gated feature.

**A Free plan organisation may create sessions with null capacity** — unlimited
enrollment is always permitted. The plan gate only applies to the maximum number
of active workshops and the maximum total participants per workshop, not to whether
individual sessions can be capacity-limited or unlimited.

---

## Subscription Schema

**Table: `subscriptions`** — see `DATA_SCHEMA_FULL.md` Table 9.

| Field | Type | Notes |
|---|---|---|
| `organization_id` | BIGINT FK | |
| `plan_code` | ENUM | `free`, `starter`, `pro`, `enterprise` |
| `status` | ENUM | `active`, `trialing`, `past_due`, `canceled`, `expired` |
| `starts_at` | DATETIME | |
| `ends_at` | DATETIME nullable | |

Stripe billing data is mirrored in `stripe_subscriptions`, `stripe_customers`,
and `stripe_invoices` tables. See `docs/command_center/COMMAND_CENTER_SCHEMA.md`.
The Stripe webhook handler that keeps these tables synchronised is not yet
implemented (see `docs/stabilization/OPEN_QUESTIONS.md` Q4).