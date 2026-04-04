# Wayfield Command Center — Overview and Architecture

## What It Is

The Command Center is a separate platform-level operations interface used
exclusively by Wayfield employees (platform_admins). It is not accessible
to organization admins, organizers, participants, or leaders.

It provides visibility and control across the entire SaaS platform:
tenant health, billing, support, automations, security, and product metrics.

---

## How It Fits in the Monorepo

```
wayfield/
├── api/          ← Laravel backend (shared — serves both web admin and command center)
├── web/          ← Organizer web admin (tenant-facing)
├── mobile/       ← Expo app (participant + leader)
└── command/      ← Command Center (platform-facing) ← NEW
```

The Command Center is a separate Next.js app in the same monorepo.
It calls the same Laravel API but hits a separate route prefix:
`/api/platform/v1` — authenticated exclusively with platform_admin tokens.

Tenant-facing API routes (`/api/v1`) do not accept platform_admin tokens.
Platform API routes (`/api/platform/v1`) do not accept tenant user tokens.
These are completely isolated at the middleware level.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15 (App Router) | Separate app in command/ |
| Auth | Laravel Sanctum (platform_admin guard) | Separate token table |
| Database | Same MySQL instance, same Laravel API | New tables added |
| Billing | Stripe | Webhooks → stripe_events table |
| Support | Crisp ($25/mo) | Webhooks mirrored locally |
| Automations | Laravel Queue + rule engine tables | Extensible |
| Charts | Recharts or Tremor | Lightweight, no backend dependency |
| Metrics | On-demand SQL queries | Aggregation hooks ready |

---

## Stripe Integration

Stripe handles all billing. The Laravel API:
- Creates Stripe customers on organization creation
- Creates/updates subscriptions via Stripe Checkout or API
- Receives webhooks for payment events
- Mirrors Stripe data into local tables for fast querying

Local tables (`stripe_customers`, `stripe_subscriptions`, `stripe_invoices`,
`stripe_events`) are the source of truth for the command center's
financial views. They are populated by Stripe webhooks, not polled.

---

## Support Integration — Crisp

Crisp is the customer support tool. Platform admins use the Crisp
dashboard for day-to-day support work. The Command Center shows a
read-only view of ticket activity via Crisp webhooks mirrored locally.

Why Crisp:
- $25/mo for the growth plan — reasonable for a small team
- Good REST API and webhook support
- Conversation + contact metadata lets you tag tickets by organization
- Can embed a chat widget in the organizer web app later

Local mirroring: Crisp webhooks → `crisp_conversations` table →
read-only view in Command Center showing open tickets per org,
response times, and volume trends. Platform admins still work
in Crisp's own interface for actual support work.

---

## Automation Engine Design

Automations follow a trigger → condition → action model.

Stored in `automation_rules` table. Evaluated by a Laravel scheduled
command that runs every 5 minutes (`php artisan automations:evaluate`).

**Built-in trigger types (Phase CC-4):**
- `invitation_pending_48h` — leader invitation not accepted after 48 hours
- `session_starting_24h` — session starts in 24 hours
- `payment_failed` — Stripe payment failure webhook received
- `organization_inactive_30d` — org has had no activity in 30 days
- `attendance_anomaly` — session check-in rate below threshold

**Built-in action types:**
- `send_email` — queued via SES
- `send_platform_notification` — in-app alert in command center
- `create_audit_log` — record the automation firing
- `send_webhook` — future: POST to external URL

Extensibility: new trigger types are registered in a `TriggerRegistry`
service class. New action types in an `ActionRegistry`. Neither requires
schema changes — only new PHP classes.

---

## Platform Admin Auth

Platform admins are entirely separate from tenant users:

- Separate `admin_users` table (no shared rows with `users`)
- Separate Sanctum token ability: `platform:*`
- Separate login endpoint: `POST /api/platform/v1/auth/login`
- Separate middleware: `auth:platform_admin`
- Tokens are stored in `personal_access_tokens` with tokenable_type
  = `App\Models\AdminUser` (Sanctum polymorphic — no custom table needed)

Platform admins cannot log into the organizer web app.
Tenant users cannot log into the command center.

---

## Impersonation (Stubbed)

The impersonation feature is scaffolded but inactive:

- `POST /api/platform/v1/impersonate/{organization}` endpoint exists
  but returns `501 Not Implemented`
- The audit log hook is wired: any future activation automatically
  logs the impersonation event
- A `can_impersonate` boolean on `admin_users` is set to false for
  all users until the feature is activated
- No UI in the command center for impersonation yet

---

## Security Boundaries

- Platform API routes behind `auth:platform_admin` middleware on every route
- No cross-contamination: platform token → tenant route = 401
- All platform admin actions written to `platform_audit_logs`
  (separate from tenant `audit_logs`)
- Admin session timeout: configurable, default 8 hours
- Admin accounts support IP allowlisting (config-based, not DB-based initially)
- Failed login attempts tracked in `admin_login_events`

---

## Deployment

The command center is deployed separately from the organizer web app:

| App | URL | Deployment |
|---|---|---|
| Organizer Web | app.yourdomain.com | Vercel or AWS Amplify |
| Command Center | ops.yourdomain.com | Separate Vercel project or EC2 |
| Laravel API | api.yourdomain.com | EC2 + Nginx |

The command center should never be publicly discoverable.
Use a non-obvious subdomain (`ops`, `platform`, `cc`) and
consider IP restriction at the Nginx or CloudFront level.

---

## Non-Negotiable Rules

- Platform admins can VIEW all tenant data — they cannot MUTATE tenant data
  except through explicitly defined platform actions (feature flags, plan changes)
- Every platform admin action is written to `platform_audit_logs`
- No hardcoding of admin credentials, plan limits, or feature keys
- Plan limits live in config/plans.php — not in the codebase directly
- All sensitive platform endpoints rate-limited independently of tenant API limits
