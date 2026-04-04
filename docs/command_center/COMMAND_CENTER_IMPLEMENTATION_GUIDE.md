# Wayfield Command Center — Implementation Guide and Prompt Plan

## When to Start This

Begin Command Center work after API Phase 9 is complete and tested.
The Command Center is a Phase 10+ effort that runs in parallel with
web and mobile UI development — it does not block either.

Recommended timing:
- API Phases 1–9: complete first
- Web Phases 1–3: can run in parallel with Command Center setup
- Command Center API phases: start after API Phase 9
- Command Center web app: start after CC-API Phase 3

---

## Monorepo Addition

Before any Claude Code work, scaffold the command center app:

```bash
# From wayfield/ root:
npx create-next-app@latest command \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"

cd command
```

Create `command/CLAUDE.md`:

```bash
cat > CLAUDE.md << 'EOF'
# Wayfield Command Center — Next.js Context

This is the platform operations interface for Wayfield.
It is used ONLY by Wayfield platform administrators — not by customers.

Root project memory: ../CLAUDE.md
Constitutional authority: ../MASTER_PROMPT.md
Command Center overview: ../docs/command_center/OVERVIEW.md
Command Center schema: ../docs/command_center/SCHEMA.md
Platform API routes: ../docs/command_center/API.md

## Stack
- Next.js 15 (App Router)
- TypeScript, Tailwind CSS, Tremor (charts and dashboards)
- API calls to Laravel at http://localhost:8000/api/platform/v1
- Bearer tokens from admin_users (NOT tenant users)

## Critical Rules
- This app serves platform_admins ONLY
- Never mix platform admin tokens with tenant tokens
- All mutations must show confirmation dialogs
- Every destructive action is highlighted in Coral Red #E94F37
- Platform admins can view but not impersonate (stubbed)

## Commands
npm run dev   # start on http://localhost:3001
npm run build
npm run lint
EOF
```

Add Tremor for dashboard components:
```bash
npm install @tremor/react recharts lucide-react react-hot-toast
npm install react-hook-form @hookform/resolvers zod date-fns axios
```

Update `.gitignore` in root to include `command/.env.local`.

---

# API Implementation — Command Center Phases

These phases add new routes under `/api/platform/v1` to the existing
Laravel API. Run from `wayfield/api/`.

---

## CC-API Phase 1 — Platform Admin Auth and Schema

### Pre-Phase Checklist
- [ ] API Phases 1–9 complete
- [ ] All existing tests green
- [ ] Stripe account created (https://stripe.com)
- [ ] Crisp account created (https://crisp.chat) — free tier is fine to start

### Claude Code Session

```bash
cd wayfield/api
claude
```

---

**CC-API PHASE 1 PROMPT:**

You are generating the Command Center foundation for Wayfield.
This adds a platform-level API layer alongside the existing tenant API.

Read before writing any code:
- @../docs/command_center/OVERVIEW.md
- @../docs/command_center/SCHEMA.md
- @../docs/03_schema/DATA_SCHEMA_FULL.md

Build the following. The platform API lives at /api/platform/v1 —
separate from the tenant API at /api/v1.

**1. Migrations — run in this exact order:**
Create migrations for ALL 15 tables defined in SCHEMA.md:
admin_users, admin_login_events, platform_audit_logs,
stripe_customers, stripe_subscriptions, stripe_invoices, stripe_events,
automation_rules, automation_runs, crisp_conversations,
login_events, security_events, failed_jobs_log,
metric_snapshots, platform_config

After creating platform_config migration, create a seeder that inserts:
- platform_admin_session_timeout_hours = '8'
- automation_evaluation_interval_minutes = '5'
- security_brute_force_threshold = '10'
- stripe_webhook_secret = '' (empty, set via env)
- crisp_website_id = '' (empty, set via env)
- crisp_webhook_secret = '' (empty, set via env)

**2. AdminUser Model**
- Implements Authenticatable
- Uses HasApiTokens (Sanctum)
- password column is password_hash (override getAuthPassword())
- Roles: super_admin, admin, support, billing, readonly
- Constants: ROLES array, ROLES_WITH_BILLING, ROLES_WITH_FLAGS
- Relationship: hasMany(PlatformAuditLog)

**3. Platform Admin Guard**
In config/auth.php, add a 'platform_admin' guard:
  driver: sanctum
  provider: admin_users

In config/auth.php providers:
  admin_users:
    driver: eloquent
    model: App\Models\AdminUser

**4. Platform Auth Controller and Routes**

Routes prefix: /api/platform/v1
File: routes/platform.php (new file, loaded in bootstrap/app.php)
Middleware: all platform routes behind 'auth:platform_admin'
except login

Endpoints:
  POST /api/platform/v1/auth/login
    - Validates email + password against admin_users
    - Creates Sanctum token with ability 'platform:*'
    - Writes admin_login_events record (success)
    - On failure: writes admin_login_events record (failed)
    - Brute force: after N failed attempts from same IP (from platform_config),
      write security_events record with severity 'high'
    - Returns: { token, admin_user: { id, first_name, last_name, email, role } }

  POST /api/platform/v1/auth/logout
    - Revokes current Sanctum token
    - Auth required: platform_admin guard

  GET /api/platform/v1/auth/me
    - Returns current admin user
    - Auth required

**5. PlatformAuditService**
Singleton service: PlatformAuditService::record($action, $adminUser, $options)
Options: entity_type, entity_id, organization_id, metadata_json, ip_address
Call this from all future platform controllers — never write to platform_audit_logs
directly from controllers.

**6. Write login_events on tenant auth**
In the existing LoginUserAction (tenant auth), add a call to write
a login_events row on every attempt (success and failure).
This is the tenant user login log — separate from admin_login_events.

**7. Platform middleware: EnsurePlatformAdmin**
Middleware that verifies the authenticated user is an AdminUser (not a User).
Applies to all /api/platform/v1 routes except login.

**8. Tests**
- Platform admin can login with valid credentials
- Platform admin login creates admin_login_events record
- Invalid credentials creates failed admin_login_events record
- Platform token cannot access tenant API routes (/api/v1/me → 401)
- Tenant token cannot access platform API routes (/api/platform/v1/auth/me → 401)
- Logout revokes token

---

### Acceptance Checklist
- [ ] All 15 migrations run without error
- [ ] `platform_config` seeded with default values
- [ ] Platform admin can log in via POST /api/platform/v1/auth/login
- [ ] Platform token rejected on /api/v1 routes
- [ ] Tenant token rejected on /api/platform/v1 routes
- [ ] Login attempts write to admin_login_events
- [ ] Tenant user logins write to login_events
- [ ] All tests green

### Commit
```bash
git add .
git commit -m "feat(api): CC Phase 1 — platform admin auth, schema foundation"
```

---

## CC-API Phase 2 — Stripe Integration

### Pre-Phase Checklist
- [ ] CC-API Phase 1 complete
- [ ] Stripe account created
- [ ] Stripe secret key and webhook secret in hand
- [ ] `composer require stripe/stripe-php`

### Environment Variables to Add

In `api/.env`:
```
STRIPE_KEY=sk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Claude Code Session

---

**CC-API PHASE 2 PROMPT:**

Build the Stripe billing integration for Wayfield.

Reference:
- @../docs/command_center/SCHEMA.md (stripe_* tables)
- @../docs/command_center/OVERVIEW.md (Stripe integration section)

The system uses Stripe for billing. Local tables mirror Stripe data
for fast querying. Stripe webhooks are the source of truth.

**1. StripeWebhookController**
Route: POST /api/platform/webhooks/stripe (NO auth middleware — Stripe calls this)
Security: validate signature using STRIPE_WEBHOOK_SECRET via
  \Stripe\Webhook::constructEvent()
If signature invalid: return 400 immediately

On valid event:
  1. Check stripe_events table for this stripe_event_id
  2. If already exists: return 200 (idempotent)
  3. Write to stripe_events with processed_at = null
  4. Dispatch ProcessStripeEventJob to queue

ProcessStripeEventJob handles:
  customer.created → create/update stripe_customers
  customer.subscription.created → create stripe_subscriptions
  customer.subscription.updated → update stripe_subscriptions + sync subscriptions table
  customer.subscription.deleted → update status in stripe_subscriptions
  invoice.paid → create/update stripe_invoices, update stripe_subscriptions
  invoice.payment_failed → create stripe_invoices with failed status,
    create security_events record with event_type='payment_failed',
    trigger payment_failed automation evaluation
  invoice.created → create stripe_invoices as 'open'
  After processing: update stripe_events.processed_at = now()
  On error: update stripe_events.error_message, log to failed_jobs_log

**2. Stripe Service (StripeService)**
Wrapper around the Stripe PHP SDK:
  createCustomer(Organization $org) → creates Stripe customer, writes stripe_customers
  createCheckoutSession($orgId, $planCode, $successUrl, $cancelUrl)
  cancelSubscription($stripeSubscriptionId)
  getUpcomingInvoice($stripeSubscriptionId)

**3. Platform Billing Endpoints**
All under /api/platform/v1/organizations/{organization}/billing
Auth: platform_admin, role IN ('super_admin', 'admin', 'billing')

  GET  /billing          → current subscription + recent invoices
  GET  /billing/invoices → paginated invoice list
  POST /billing/plan     → change plan (calls Stripe + updates local)
    Body: { plan_code }
    Writes platform_audit_logs record: action='plan_changed'

**4. Tenant-facing Stripe Endpoints** (for organizer web app)
Under /api/v1/organizations/{organization}/billing (existing route, now implemented)
  GET  /subscription           → current subscription from stripe_subscriptions
  POST /billing/checkout       → create Stripe Checkout session
  POST /billing/portal         → create Stripe Customer Portal session
  POST /webhooks/stripe-return → handle post-checkout redirect (update subscription)

**5. Sync existing subscriptions to Stripe**
Create a command: php artisan stripe:sync-customers
Iterates all organizations that don't have a stripe_customers row
and creates Stripe customer records for them.
Useful for bootstrapping existing data.

**6. Tests**
- Webhook with invalid signature returns 400
- Webhook with duplicate stripe_event_id returns 200 without processing
- invoice.paid creates stripe_invoices row
- invoice.payment_failed creates security_events row
- Plan change writes platform_audit_logs record

---

### Acceptance Checklist
- [ ] Stripe webhook endpoint validates signatures
- [ ] Duplicate webhook events are idempotent
- [ ] invoice.paid creates a stripe_invoices row
- [ ] Plan change through platform API writes audit log
- [ ] Organizer can initiate checkout via /api/v1 endpoint
- [ ] All tests green

### Commit
```bash
git add .
git commit -m "feat(api): CC Phase 2 — Stripe billing integration"
```

---

## CC-API Phase 3 — Platform Dashboard Metrics

### Claude Code Session

---

**CC-API PHASE 3 PROMPT:**

Build the platform metrics and overview endpoints.
All queries run on-demand. metric_snapshots table is present
but not yet populated — aggregation jobs are future scope.

Reference:
- @../docs/command_center/OVERVIEW.md
- @../docs/command_center/SCHEMA.md

Build:

**1. Platform Overview Endpoint**
GET /api/platform/v1/overview
Auth: any platform_admin role

Returns one JSON object with:
  organizations:
    total: COUNT(*) from organizations
    active: COUNT(*) WHERE status = 'active'
    by_plan: GROUP BY plan_code from stripe_subscriptions
    new_this_month: created_at >= start of current month
    churned_this_month: stripe_subscriptions canceled_at >= start of month

  revenue:
    mrr: SUM of current active subscription amounts
         (join stripe_subscriptions → stripe_prices for amount)
    arr: mrr * 12

  workshops:
    active: COUNT(*) WHERE status IN ('draft','published')
              AND end_date >= today

  users:
    total_participants: COUNT DISTINCT user_id from registrations
    total_leaders: COUNT(*) from leaders
    total_active_users: users where last_login_at >= 30 days ago

  operations:
    session_fill_rate: AVG(selected_count / capacity)
                       WHERE capacity IS NOT NULL
    attendance_rate: COUNT(checked_in) / COUNT(attendance_records)
    no_show_rate: COUNT(no_show) / COUNT(attendance_records)

  health:
    queue_backlog: COUNT(*) from failed_jobs WHERE failed_at >= 24h ago
    failed_jobs_24h: COUNT(*) from failed_jobs_log WHERE failed_at >= 24h ago
    open_security_events: COUNT(*) from security_events WHERE is_resolved = false
    unresolved_support: COUNT(*) from crisp_conversations WHERE status != 'resolved'

**2. Organizations List Endpoint**
GET /api/platform/v1/organizations
Auth: any platform_admin role
Params: page, per_page (default 25), search, plan, status

Returns paginated list. Each org includes:
  id, name, slug, status, created_at
  plan_code, subscription_status (from stripe_subscriptions)
  workshop_count, participant_count, leader_count, organizer_count
  last_activity_at (max of any related updated_at — approximate)
  open_support_tickets (count from crisp_conversations)

**3. Organization Detail Endpoint**
GET /api/platform/v1/organizations/{organization}
Auth: any platform_admin role

Returns full organization data:
  organization fields
  subscription details
  usage vs plan limits (workshops used / max, participants, managers)
  feature_flags list for this org
  recent audit_log entries (last 10)
  workshop list (last 5)
  recent login_events (last 10 for users in this org)
  automation_runs triggered for this org (last 5)
  crisp_conversations (last 5)

**4. User Overview Endpoint**
GET /api/platform/v1/users
Params: page, search, role, verified, active

Returns paginated global user list with:
  id, first_name, last_name, email, is_active, email_verified_at
  organization memberships (org name + role)
  last_login_at, login_count (last 30 days from login_events)
  leader_id if linked
  account_status: derive as 'active'|'unverified'|'inactive'

**5. Security Events Endpoint**
GET /api/platform/v1/security
Params: severity, resolved, page

Returns paginated security_events with resolution status.
PATCH /api/platform/v1/security/{event}/resolve
  Marks is_resolved = true, writes platform_audit_logs

**6. Tests**
- Overview endpoint returns expected structure
- Organization list is paginated and filterable
- Organization detail includes usage vs limits
- User list is searchable
- Security event can be resolved and writes audit log

---

### Acceptance Checklist
- [ ] GET /api/platform/v1/overview returns all dashboard metrics
- [ ] Organization list paginates and filters by plan
- [ ] Organization detail shows feature flags and audit log
- [ ] User list is searchable by name and email
- [ ] Security events can be resolved
- [ ] All tests green

### Commit
```bash
git add .
git commit -m "feat(api): CC Phase 3 — platform metrics, org detail, user overview"
```

---

## CC-API Phase 4 — Automation Engine

### Claude Code Session

---

**CC-API PHASE 4 PROMPT:**

Build the automation rule engine.

Reference:
- @../docs/command_center/OVERVIEW.md (Automation Engine Design section)
- @../docs/command_center/SCHEMA.md (automation_rules, automation_runs)

**1. TriggerRegistry Service**
Singleton registry of all available trigger types.
Each trigger is a class implementing TriggerInterface:
  interface TriggerInterface {
    public function evaluate(): Collection;  // returns entities to act on
    public function getKey(): string;
    public function getLabel(): string;
    public function getConfigSchema(): array;
  }

Built-in trigger classes:
  InvitationPending48hTrigger
    → finds leader_invitations WHERE status = 'pending'
      AND created_at <= now() - 48 hours
      AND responded_at IS NULL

  SessionStarting24hTrigger
    → finds sessions WHERE start_at BETWEEN now() AND now() + 24 hours
      AND is_published = true
      AND (send reminder not already sent — check automation_runs)

  PaymentFailedTrigger
    → finds stripe_invoices WHERE status = 'open'
      AND attempt_count > 0
      AND next_payment_attempt IS NULL (no retry scheduled)

  OrganizationInactive30dTrigger
    → finds organizations WHERE last activity > 30 days ago
      (approximate: max updated_at across workshops, sessions, registrations)

  AttendanceAnomalyTrigger
    → finds completed sessions WHERE check_in_rate < threshold
      threshold from automation_rules.conditions_json

**2. ActionRegistry Service**
Built-in action classes implementing ActionInterface:
  interface ActionInterface {
    public function execute($entity, array $config): void;
    public function getKey(): string;
  }

Built-in action classes:
  SendEmailAction
    → dispatches queued SendAutomationEmailJob
    → config: { template, subject, recipient_type }

  SendPlatformNotificationAction
    → creates a row in a new platform_notifications table
    → visible in command center notification bell

  CreateAuditLogAction
    → writes platform_audit_logs record with automation context

  SendWebhookAction
    → stubs: logs intent, does not send (future implementation)

**3. EvaluateAutomationsCommand**
php artisan automations:evaluate

Scheduled every N minutes (from platform_config.automation_evaluation_interval_minutes).
For each active automation_rule:
  1. Check if enough time has passed since last_evaluated_at
  2. Instantiate TriggerRegistry::get($trigger_type)
  3. Call trigger->evaluate() to get entities
  4. Apply conditions_json filters
  5. For each entity: instantiate ActionRegistry::get($action_type)
  6. Call action->execute($entity, $config)
  7. Write automation_runs record with outcome and count
  8. Update automation_rules.last_evaluated_at

**4. Platform Automation Endpoints**
GET  /api/platform/v1/automations          → list rules, paginated
POST /api/platform/v1/automations          → create rule
GET  /api/platform/v1/automations/{id}     → rule detail + recent runs
PATCH /api/platform/v1/automations/{id}    → update rule
DELETE /api/platform/v1/automations/{id}   → deactivate (soft)
GET  /api/platform/v1/automations/{id}/runs → paginated run history

Auth: super_admin or admin role only

All create/update/delete operations write to platform_audit_logs.

**5. Tests**
- InvitationPending48hTrigger returns correct invitations
- SessionStarting24hTrigger returns sessions in window
- EvaluateAutomationsCommand writes automation_runs record
- Duplicate evaluation within run_interval_minutes is skipped
- Creating a rule writes platform_audit_logs
- Deactivated rule is not evaluated

---

### Acceptance Checklist
- [ ] TriggerRegistry has all 5 built-in triggers
- [ ] ActionRegistry has all 4 built-in actions
- [ ] `php artisan automations:evaluate` runs without error
- [ ] automation_runs records created after evaluation
- [ ] Platform endpoints for rule CRUD work
- [ ] All tests green

### Commit
```bash
git add .
git commit -m "feat(api): CC Phase 4 — automation engine, trigger/action registry"
```

---

## CC-API Phase 5 — Support (Crisp), Feature Flags, Impersonation Stub

### Claude Code Session

---

**CC-API PHASE 5 PROMPT:**

Build Crisp integration, platform feature flag management,
and impersonation stub.

Reference:
- @../docs/command_center/OVERVIEW.md
- @../docs/command_center/SCHEMA.md

**1. Crisp Webhook Receiver**
Route: POST /api/platform/webhooks/crisp (no auth — Crisp calls this)
Security: validate X-Crisp-Signature header using crisp_webhook_secret
from platform_config

On conversation:created, conversation:resolved, message:send events:
  Upsert crisp_conversations row with current state.
  Match organization by looking up the Crisp contact metadata for
  organization_id (set when embedding Crisp in the organizer web app).

**2. Platform Feature Flag Endpoints**
GET  /api/platform/v1/organizations/{org}/feature-flags
  → returns all feature_flags rows for the org

POST /api/platform/v1/organizations/{org}/feature-flags
  Body: { feature_key, is_enabled }
  → creates/updates feature_flags row with source = 'manual_override'
  → MUST write platform_audit_logs record with action = 'feature_flag_overridden'
  → Auth: super_admin or admin role only

DELETE /api/platform/v1/organizations/{org}/feature-flags/{key}
  → deletes manual override, falls back to plan-derived value
  → writes platform_audit_logs

**3. Impersonation Stub**
POST /api/platform/v1/impersonate/{organization}
  Auth: super_admin role AND admin_users.can_impersonate = true
  Response: 501 Not Implemented
  { "error": "not_implemented",
    "message": "Impersonation is not yet active.",
    "stub": true }
  Write platform_audit_logs with action = 'impersonation_attempted'
  even though it returns 501 — this logs the intent.

**4. Platform Admin Management**
GET  /api/platform/v1/admin-users          → list platform admins
POST /api/platform/v1/admin-users          → create new platform admin
  Auth: super_admin only
  Body: first_name, last_name, email, role, password, password_confirmation
  Writes platform_audit_logs

PATCH /api/platform/v1/admin-users/{id}    → update role or is_active
  Auth: super_admin only
  Cannot demote the last super_admin

**5. Support Overview Endpoints**
GET /api/platform/v1/support/conversations
  → paginated crisp_conversations ordered by last_message_at
  → filter: status, organization_id

GET /api/platform/v1/support/stats
  → open count, avg first reply time, resolved today, by org breakdown

Note: Platform admins work in Crisp's own interface for actual support.
These endpoints provide visibility only.

**6. Tests**
- Crisp webhook with bad signature returns 400
- Feature flag override writes audit log
- Feature flag override requires admin/super_admin role
- Support role cannot set feature flags (403)
- Impersonation stub returns 501 AND writes audit log
- Cannot demote last super_admin

---

### Acceptance Checklist
- [ ] Crisp webhook validates signature
- [ ] Feature flag override creates audit log
- [ ] Support role cannot override feature flags
- [ ] Impersonation returns 501 and logs the attempt
- [ ] Admin user management restricted to super_admin
- [ ] All tests green

### Commit
```bash
git add .
git commit -m "feat(api): CC Phase 5 — Crisp, feature flags, impersonation stub"
```

---

# Command Center Web App — Next.js Phases

Run from `wayfield/command/`. The Laravel platform API must be running.

---

## CC-Web Phase 1 — Auth, Shell, and Dashboard

### Claude Code Session

```bash
cd wayfield/command
claude
```

---

**CC-WEB PHASE 1 PROMPT:**

Build the Command Center Next.js app foundation.

Read:
- @./CLAUDE.md
- @../docs/command_center/OVERVIEW.md

The platform API runs at http://localhost:8000/api/platform/v1.
Auth uses Sanctum Bearer tokens from platform admin login.
This app runs on port 3001 (set in package.json dev script).

Build:

**1. API Client (lib/api/client.ts)**
Platform-specific client:
  - Attaches Authorization: Bearer header from stored token
  - On 401: clears token, redirects to /login
  - Base URL: process.env.NEXT_PUBLIC_PLATFORM_API_URL
  - Never mix with tenant API client

**2. Token Storage (lib/auth/session.ts)**
  - Store in httpOnly cookie: 'cc_platform_token'
  - Functions: getToken(), setToken(), clearToken(), getAdminUser()

**3. Middleware (middleware.ts)**
  - Protect all /dashboard/* routes — redirect to /login without token
  - Redirect logged-in admins away from /login

**4. Login Screen**
  - Wayfield Command Center wordmark
  - Email + password
  - POST /api/platform/v1/auth/login
  - On success: store token, redirect to /dashboard
  - Visual distinction from tenant app — use dark theme or distinct color
    to make it immediately obvious this is the platform admin interface
    Suggestion: dark sidebar (#1a1a2e), accent teal #0FA3B1

**5. Admin Shell Layout (app/dashboard/layout.tsx)**
  Sidebar navigation:
    - Overview (icon: LayoutDashboard)
    - Organizations (icon: Building2)
    - Users (icon: Users)
    - Financials (icon: CreditCard)
    - Support (icon: MessageSquare)
    - Automations (icon: Zap)
    - Security (icon: Shield)
    - Audit Logs (icon: FileText)
    - Settings (icon: Settings)
  Top bar: admin name, role badge, logout button
  Role badge colors: super_admin=coral, admin=teal, support=blue,
                    billing=orange, readonly=gray

**6. Overview Dashboard (/dashboard)**
Using Tremor components for all charts and metric cards.

Metric cards row:
  Total Orgs | Active Orgs | MRR | ARR

Second row:
  Active Workshops | Total Participants | Total Leaders | Active Users (30d)

Third row:
  Session Fill Rate | Attendance Rate | No-Show Rate | Queue Backlog

Charts:
  - Organizations by plan: donut chart
  - New vs churned orgs: bar chart (monthly)

Health indicators (colored pills):
  - Failed jobs: green if 0, yellow if <5, red if 5+
  - Open security events: green if 0, red if any critical
  - Open support tickets: count

Data from GET /api/platform/v1/overview
Auto-refresh every 60 seconds.

---

### Acceptance Checklist
- [ ] Login screen visually distinct from organizer web app
- [ ] Login stores token and redirects to dashboard
- [ ] /dashboard/* routes redirect to login without token
- [ ] Tenant token rejected by platform API (test manually)
- [ ] Overview dashboard shows all metric cards
- [ ] Charts render with real data
- [ ] Auto-refresh works

### Commit
```bash
git add .
git commit -m "feat(command): CC Web 1 — auth, shell, overview dashboard"
```

---

## CC-Web Phase 2 — Organization Management

---

**CC-WEB PHASE 2 PROMPT:**

Build the organization management section.

Reference:
- @./CLAUDE.md
- @../docs/command_center/API.md (organization endpoints)

**Organizations List (/dashboard/organizations)**
- Search bar + filters: plan (All/Free/Starter/Pro/Enterprise), status
- Table columns: org name, plan badge, status, workshops, participants,
  leaders, managers, created_at, last activity, open tickets
- Click row → organization detail
- Pagination (25 per page)
- Export CSV button (downloads visible data)

**Organization Detail (/dashboard/organizations/[id])**
Tab sections:

Overview tab:
  - Org info: name, slug, status, primary contact, created_at
  - Subscription card: plan, status, current period, MRR contribution
  - Usage bar charts: workshops used/max, participants used/max, managers used/max
  - "Change Plan" button → confirmation modal → POST /billing/plan
    Write audit log shown inline after change

Feature Flags tab:
  - Table of all feature_flags for this org (key, enabled, source)
  - Toggle to enable/disable individual flags (manual_override)
  - Confirmation required before any toggle
  - Shows "Plan-derived" vs "Manual Override" badge on each flag
  - Only super_admin and admin role see the toggles; support/billing/readonly see read-only

Workshops tab:
  - List of all workshops for this org with status, session count, participant count

Users tab:
  - List of organization members with role and last login

Activity tab:
  - Recent audit_log entries for this org (tenant audit logs)
  - Recent platform_audit_logs entries affecting this org
  - Recent login_events for org members

Support tab:
  - crisp_conversations for this org
  - Link out to Crisp dashboard

---

### Acceptance Checklist
- [ ] Organization list filters by plan
- [ ] Organization detail tabs all load correctly
- [ ] Usage bars reflect real plan limits
- [ ] Feature flag toggle requires confirmation
- [ ] Support role cannot toggle feature flags
- [ ] Plan change confirmation modal and audit log feedback

### Commit
```bash
git add .
git commit -m "feat(command): CC Web 2 — organization management"
```

---

## CC-Web Phase 3 — Users, Financials, and Support

---

**CC-WEB PHASE 3 PROMPT:**

Build the users, financials, and support sections.

**Users Section (/dashboard/users)**
- Searchable table: name, email, email verified, orgs + roles,
  last login, account status badge
- Status badges: Active (green), Unverified (amber), Inactive (gray)
- Click user → user detail slide-out:
  - Profile info
  - Organization memberships
  - Login history (from login_events, last 20)
  - Leader profile info if linked
  - Invite history if a leader
  - "Lock Account" button → sets is_active = false via platform API
    Requires confirmation. Writes audit log.

**Financials Section (/dashboard/financials)**
Summary cards: MRR, ARR, Active Subscriptions, Past Due Count
Charts (Tremor):
  - MRR over last 12 months (line chart from stripe_invoices)
  - Plan distribution (pie chart)
  - New vs churned MRR (bar chart)

Invoices table:
  - All stripe_invoices, paginated
  - Filter: status, date range, org
  - Columns: org name, amount, status badge, period, paid_at, PDF link
  - Past due highlighted in coral red

Failed Payments tab:
  - stripe_invoices WHERE status != 'paid' AND attempt_count > 0
  - Shows attempt count, next retry, org name, amount

**Support Section (/dashboard/support)**
- Crisp conversations list: status badge, org, last message time, assigned agent
- Stats cards: open today, avg first reply, resolved this week
- Filter: status, organization
- Each row links out to Crisp conversation (external link)
- Note at top: "Manage conversations in Crisp. This view is read-only."

---

### Acceptance Checklist
- [ ] User search and filter works
- [ ] User detail slide-out shows login history
- [ ] Lock account requires confirmation
- [ ] MRR and ARR cards show correct values
- [ ] Invoice list filterable by status
- [ ] Past due invoices highlighted
- [ ] Support view shows Crisp conversations

### Commit
```bash
git add .
git commit -m "feat(command): CC Web 3 — users, financials, support"
```

---

## CC-Web Phase 4 — Automations, Security, and Audit Logs

---

**CC-WEB PHASE 4 PROMPT:**

Build the automations, security, and audit log sections.

**Automations Section (/dashboard/automations)**
List view:
  - Rule name, trigger type, action type, is_active toggle, last run,
    last run outcome badge (success/failed/skipped)
  - "New Rule" button → create modal

Create/Edit Rule Modal:
  - Name field
  - Trigger type: select from built-in types with descriptions
  - Conditions JSON: code editor (Monaco or simple textarea)
    with helper text showing example JSON per trigger type
  - Action type: select from built-in types
  - Action config JSON: code editor with example per action type
  - Run interval: number input (minutes)
  - Is active: toggle
  - Only super_admin and admin can create/edit

Rule Detail (/dashboard/automations/[id]):
  - Rule config display
  - Recent runs table: triggered_at, outcome, entity, actions taken, error
  - "Run Now" button → manually trigger (future — stub for now)

**Security Section (/dashboard/security)**
Open Events:
  - Table: severity badge (color-coded), event_type, description,
    user/org affected, created_at, resolve button
  - Critical events: coral red row highlight
  - "Resolve" button → confirmation modal → PATCH

Login Events:
  - Recent login_events across all users
  - Filter: outcome, IP, date range
  - Failed logins from same IP clustered visually

Admin Login Events:
  - Separate tab for admin_login_events
  - Same structure

**Audit Logs Section (/dashboard/audit-logs)**
Tabs: Platform Actions | Tenant Actions

Platform Actions (platform_audit_logs):
  - admin name, action, entity, org, timestamp, metadata preview
  - Filterable by admin, action type, org, date

Tenant Actions (audit_logs):
  - actor user, action, entity, org, timestamp
  - Read-only view into the tenant audit system
  - Filter by org, action, date

**Settings Section (/dashboard/settings)**
Platform Admin Management:
  - Table of all admin_users with role badge and status
  - "Invite Admin" button → create new admin user form
    Fields: first_name (required), last_name (required), email, role, temp password
    Only super_admin sees this section

Platform Config:
  - Table of platform_config rows
  - Edit non-sensitive values inline
  - Sensitive values shown as ****** with "Update" button
  - Changes write platform_audit_logs

---

### Acceptance Checklist
- [ ] Automation rule list shows status and last run
- [ ] Create rule modal with all fields
- [ ] Security events color-coded by severity
- [ ] Critical events highlighted in red
- [ ] Security events can be resolved with confirmation
- [ ] Platform audit log shows all admin actions
- [ ] Admin management restricted to super_admin
- [ ] Platform config editable with audit trail

### Commit
```bash
git add .
git commit -m "feat(command): CC Web 4 — automations, security, audit logs, settings"
```

---

## Environment Variables — Command Center

### command/.env.local
```env
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:8000/api/platform/v1
NEXT_PUBLIC_APP_ENV=local
```

### Staging
```env
NEXT_PUBLIC_PLATFORM_API_URL=https://api.yourdomain.com/api/platform/v1
NEXT_PUBLIC_APP_ENV=staging
```

### Production
```env
NEXT_PUBLIC_PLATFORM_API_URL=https://api.yourdomain.com/api/platform/v1
NEXT_PUBLIC_APP_ENV=production
```

---

## Full Implementation Sequence

```
Setup:   Scaffold command/ Next.js app, install packages
CC-API 1: Admin auth, all 15 migrations, tenant login events
CC-API 2: Stripe webhooks, billing sync, billing endpoints
CC-API 3: Platform metrics, org detail, user overview
CC-API 4: Automation engine, trigger/action registry
CC-API 5: Crisp webhook, feature flag management, impersonation stub
CC-Web 1: Login, shell, overview dashboard
CC-Web 2: Organization management, feature flags, plan changes
CC-Web 3: Users, financials, support view
CC-Web 4: Automations, security, audit logs, settings
```

Total: 9 focused Claude Code sessions for a complete command center.

---

## First Admin User

After CC-API Phase 1 is deployed, seed your first platform admin:

```bash
cd wayfield/api
php artisan tinker
```

```php
use App\Models\AdminUser;
use Illuminate\Support\Facades\Hash;

AdminUser::create([
    'first_name'    => 'Your',
    'last_name'     => 'Name',
    'email'         => 'you@yourdomain.com',
    'password_hash' => Hash::make('your-secure-password'),
    'role'          => 'super_admin',
    'is_active'     => true,
    'can_impersonate' => false,
]);
```

Never hardcode this. Create via tinker or a secure one-time seeder
that reads credentials from environment variables.

---

## API Route Files to Create

The platform API lives in a separate route file.
In `api/routes/platform.php` (new file):

```php
<?php
// All routes here are prefixed /api/platform/v1
// Loaded in bootstrap/app.php with prefix and middleware

Route::post('auth/login',  [PlatformAuthController::class, 'login']);
Route::post('webhooks/stripe', [StripeWebhookController::class, 'handle']);
Route::post('webhooks/crisp',  [CrispWebhookController::class, 'handle']);

Route::middleware('auth:platform_admin')->group(function () {
    Route::post('auth/logout', [PlatformAuthController::class, 'logout']);
    Route::get('auth/me',      [PlatformAuthController::class, 'me']);

    Route::get('overview', [PlatformOverviewController::class, 'index']);

    Route::apiResource('organizations', PlatformOrganizationController::class)
        ->only(['index', 'show']);
    Route::prefix('organizations/{organization}')->group(function () {
        Route::get('billing',               [PlatformBillingController::class, 'show']);
        Route::get('billing/invoices',      [PlatformBillingController::class, 'invoices']);
        Route::post('billing/plan',         [PlatformBillingController::class, 'changePlan']);
        Route::get('feature-flags',         [PlatformFeatureFlagController::class, 'index']);
        Route::post('feature-flags',        [PlatformFeatureFlagController::class, 'store']);
        Route::delete('feature-flags/{key}',[PlatformFeatureFlagController::class, 'destroy']);
    });

    Route::get('users',             [PlatformUserController::class, 'index']);
    Route::get('users/{user}',      [PlatformUserController::class, 'show']);
    Route::patch('users/{user}/lock',[PlatformUserController::class, 'lock']);

    Route::apiResource('automations', PlatformAutomationController::class);
    Route::get('automations/{automation}/runs',
        [PlatformAutomationController::class, 'runs']);

    Route::get('security',             [PlatformSecurityController::class, 'index']);
    Route::patch('security/{event}/resolve',
        [PlatformSecurityController::class, 'resolve']);

    Route::get('audit-logs',           [PlatformAuditLogController::class, 'platform']);
    Route::get('audit-logs/tenant',    [PlatformAuditLogController::class, 'tenant']);

    Route::get('support/conversations',[PlatformSupportController::class, 'index']);
    Route::get('support/stats',        [PlatformSupportController::class, 'stats']);

    Route::get('admin-users',          [AdminUserController::class, 'index']);
    Route::post('admin-users',         [AdminUserController::class, 'store']);
    Route::patch('admin-users/{id}',   [AdminUserController::class, 'update']);

    Route::post('impersonate/{organization}',
        [ImpersonationController::class, 'initiate']);
});
```
