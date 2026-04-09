# Command Center — Frontend Phase Prompts
## docs/command_center/COMMAND_CENTER_PHASE_PROMPTS.md

> **Backend:** Complete. All five CC-API phases are done.
> **Frontend:** NOT started. These prompts are for building CC-Web Phases 1–4.
>
> Before using any prompt in this file:
> - Read `COMMAND_CENTER_OVERVIEW.md`
> - Read `COMMAND_CENTER_IMPLEMENTATION_GUIDE.md`
> - Read `NAVIGATION_SPEC.md`
> - Read `COMMAND_CENTER_SCHEMA.md`
> - Read `docs/02_domain/ROLE_MODEL.md` Section 7 (Platform Admin Role Taxonomy)
>
> Work from `command/` directory when running Claude Code.

---

## CC-Web Phase 1 Prompt — Auth, Shell, Overview Dashboard
You are building CC-Web Phase 1 of the Wayfield Command Center frontend.
The Command Center is an internal platform admin tool for Wayfield employees only.
It is NOT the tenant admin (web/). It is a completely separate Next.js app in command/.
Read before writing any code:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/COMMAND_CENTER_IMPLEMENTATION_GUIDE.md
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/02_domain/ROLE_MODEL.md
Critical isolation rule:
The Command Center uses a SEPARATE auth guard (auth:platform_admin), a SEPARATE
user table (admin_users), and routes under /api/platform/v1/*.
The platform admin token must NEVER be stored alongside or confused with the
tenant user token from web/.
Build the following in command/:
═══════════════════════════════════════════════════════════
PART 1 — Bootstrap
═══════════════════════════════════════════════════════════
Set up the command/ Next.js app foundation:

App Router structure
Tailwind CSS dark theme base (dark sidebar shell)
Platform API client at command/lib/platform-api.ts
Base URL from NEXT_PUBLIC_PLATFORM_API_URL env variable
All requests send Authorization: Bearer {token}
On 401: clear token and redirect to /login
AdminUserContext at command/context/AdminUserContext.tsx
Fields: id, first_name, last_name, email, role
Role type: 'super_admin' | 'admin' | 'support' | 'billing' | 'readonly'
Token storage utility: store/retrieve/clear from localStorage
Key: 'cc_platform_token' (must not conflict with web/ token)
Route guard: all routes except /login redirect unauthenticated users to /login
Environment setup: .env.local.example with NEXT_PUBLIC_PLATFORM_API_URL

Brand fonts (same as web/):

Headings: Sora
Body/UI: Plus Jakarta Sans
Accent: JetBrains Mono

═══════════════════════════════════════════════════════════
PART 2 — Login Screen
═══════════════════════════════════════════════════════════
Route: /login (public)
API: POST /api/platform/v1/auth/login
Request: { email, password }
Response: { token, admin_user: { id, first_name, last_name, email, role } }
Design:

Dark-themed, centred card layout
Wayfield logo + "Command Center" label
Email and password inputs
Login button
Clear error states (invalid credentials, network error)
No registration link — admin accounts are created by super_admin

On success:

Store token as 'cc_platform_token'
Set AdminUserContext
Redirect to / (overview dashboard)

═══════════════════════════════════════════════════════════
PART 3 — Dark Sidebar Shell
═══════════════════════════════════════════════════════════
Applied to all authenticated routes. Layout component at command/app/(admin)/layout.tsx.
Sidebar (dark background):

Wayfield logo + "Command Center" wordmark
Navigation items per NAVIGATION_SPEC.md:
Overview (always visible)
Organisations (all except readonly: show as read-only)
Users (super_admin, admin, support only)
Financials (super_admin, billing only)
Support (super_admin, admin, support only)
Automations (super_admin, admin only)
Security (super_admin, admin, support only)
Audit Log (super_admin, admin only)
Settings (super_admin only)
Active route highlighted
Items the current admin cannot access: hidden (not greyed out)
Role badge for current admin user at the bottom of sidebar

Top bar:

Admin full name
Role badge (colour-coded per NAVIGATION_SPEC.md)
Logout button (calls POST /api/platform/v1/auth/logout, clears token, redirects to /login)

Main content area:

Light background (contrasts with dark sidebar)
Page title area
Content slot

═══════════════════════════════════════════════════════════
PART 4 — Overview Dashboard
═══════════════════════════════════════════════════════════
Route: / (authenticated)
API: GET /api/platform/v1/overview
Metric cards (top row):

Total organisations (with breakdown: free / starter / pro / enterprise)
Monthly Recurring Revenue (from Stripe mirror — note: may be stale if webhook not wired)
Active users (users with last_login_at in last 30 days)
Recent signups (registrations in last 7 days)

Plan distribution chart:

Donut or bar chart using recharts
Shows count per plan code
Colour-coded: Free (grey), Starter (teal), Pro (orange), Enterprise (coral)

Recent activity section:

Last 10 entries from platform_audit_logs
Columns: admin, action, organisation, time ago

All states:

Loading: skeleton cards and skeleton chart
Error: error banner with retry
Empty audit log: "No recent platform activity" message

═══════════════════════════════════════════════════════════
TESTS
═══════════════════════════════════════════════════════════
Write tests covering:

Login success: token stored, redirected to /
Login failure: error message shown, no redirect
Unauthenticated access to / redirects to /login
Platform admin token is never sent to /api/v1/* routes
(verify the platform API client always uses NEXT_PUBLIC_PLATFORM_API_URL base)
Sidebar hides Settings for admin role (only super_admin sees it)
Logout: clears token, redirects to /login

Acceptance criteria:

Admin can log in and see the dark sidebar shell
Sidebar shows correct items for each role variant
Overview dashboard renders stat cards and plan distribution chart
Logout clears session completely

---

## CC-Web Phase 2 Prompt — Organisation Management
You are building CC-Web Phase 2 of the Wayfield Command Center frontend.
CC-Web Phase 1 (auth, shell, overview) must be complete before starting this phase.
Read before writing any code:
@../docs/command_center/COMMAND_CENTER_OVERVIEW.md
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@../docs/02_domain/ROLE_MODEL.md
═══════════════════════════════════════════════════════════
PART 1 — Organisations List
═══════════════════════════════════════════════════════════
Route: /organizations
API: GET /api/platform/v1/organizations
Query params: search, plan, status, page
Table columns:

Name (clickable → organisation detail)
Plan badge (Free / Starter / Pro / Enterprise — colour-coded)
Status badge (active / inactive / suspended)
Participants (count)
Workshops (count, active vs total)
Last active (relative timestamp)
Actions: View detail

Filters (top of list):

Search by organisation name or contact email
Plan filter (multi-select)
Status filter

Empty state: "No organisations found."
Loading state: skeleton rows
═══════════════════════════════════════════════════════════
PART 2 — Organisation Detail
═══════════════════════════════════════════════════════════
Route: /organizations/{id}
API: GET /api/platform/v1/organizations/{id}
Tab structure (per NAVIGATION_SPEC.md):

Overview
Billing
Feature Flags
Usage
Audit

Overview tab:

Organisation name, slug, status
Primary contact details
Current plan and subscription status
Workshop count, participant count, manager count
Created date

Billing tab:
API: GET /api/platform/v1/organizations/{id}/billing

Current plan and billing status
Invoice list (from stripe_invoices mirror)
Plan change button (visible to super_admin and billing role only)
→ opens Plan Change modal
→ calls POST /api/platform/v1/organizations/{id}/billing/plan
→ writes platform_audit_logs (confirmed by API)
Note: invoice data may be stale if Stripe webhook is not yet wired.
Show a notice: "Billing data is mirrored from Stripe. May not reflect
real-time changes until the webhook handler is configured."

Feature Flags tab:
API: GET /api/platform/v1/organizations/{id}/feature-flags

List of all feature flags for this org
Each row: feature_key, current value (enabled/disabled toggle), source badge
(plan_default vs manual_override)
Toggle visible to super_admin and admin only
→ calls POST /api/platform/v1/organizations/{id}/feature-flags
→ body: { feature_key, is_enabled }
→ confirmation toast on success
→ writes platform_audit_logs (confirmed by API)

Usage tab:
API: GET /api/platform/v1/organizations/{id} (usage fields in response)

Active workshops vs plan limit (usage bar)
Participants vs plan limit (usage bar)
Managers vs plan limit (usage bar)
Bars: green → amber at 80% → red at 100%

Audit tab (organisation-scoped):
API: GET /api/platform/v1/audit-logs?organization_id={id}

Last 50 platform audit events for this organisation
Columns: admin, action, entity, time
Expandable metadata row

═══════════════════════════════════════════════════════════
TESTS
═══════════════════════════════════════════════════════════

Organisations list renders with search and plan filter
Clicking an organisation navigates to detail page
Plan change modal appears only for super_admin and billing roles
Feature flag toggle sends correct API request and shows confirmation toast
billing role cannot see Feature Flags tab (hidden in sidebar, or tab disabled)
Usage bars display correct colour thresholds

Acceptance criteria:

Platform admin can browse all organisations
Plan change is restricted by role and produces audit entry
Feature flag toggle is restricted by role and produces audit entry
Billing note about Stripe webhook stale data is displayed

---

## CC-Web Phase 3 Prompt — Users, Financials, Support
You are building CC-Web Phase 3 of the Wayfield Command Center frontend.
CC-Web Phases 1 and 2 must be complete before starting this phase.
Read before writing any code:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@../docs/02_domain/ROLE_MODEL.md
═══════════════════════════════════════════════════════════
PART 1 — Users List
═══════════════════════════════════════════════════════════
Route: /users (visible to super_admin, admin, support only)
API: GET /api/platform/v1/users
Query params: search, page
Table columns:

Name
Email
Organisations (count of org memberships)
Last login (relative timestamp or "Never")
Verified badge
Actions: View detail (opens slide-over)

User Detail Slide-over:
API: GET /api/platform/v1/users/{id}

Name, email, joined date, email verified status
Organisation memberships: org name, role badge per org
Login history: last 10 entries from login_events table
Columns: date/time, platform, outcome (success/failed/blocked)

No edit capability — platform admins read tenant user data only.
No delete capability.
═══════════════════════════════════════════════════════════
PART 2 — Financials
═══════════════════════════════════════════════════════════
Route: /financials (visible to super_admin and billing roles only)
API: GET /api/platform/v1/financials/overview
Summary cards:

MRR (Monthly Recurring Revenue from active subscriptions)
ARR (Annual Recurring Revenue estimate)
Active paying subscriptions count
Trial subscriptions count

Subscription breakdown:

Count and revenue per plan (Starter, Pro, Enterprise)
Status breakdown (active, trialing, past_due, canceled)

Invoices list:
API: GET /api/platform/v1/financials/invoices

Columns: organisation, amount, status, date, PDF link
Filter by status (paid, unpaid, overdue)

Important note — display prominently on this screen:
"Financial data is mirrored from Stripe. This data may not reflect
real-time changes until the Stripe webhook handler is configured.
See: docs/stabilization/OPEN_QUESTIONS.md Q4"
═══════════════════════════════════════════════════════════
PART 3 — Support
═══════════════════════════════════════════════════════════
Route: /support (visible to super_admin, admin, support roles)
This section does NOT build a full ticket UI from the database.
Instead, it provides a link to the external support tool.
Display:

Card with the Freshdesk (or configured support tool) logo
"View Support Dashboard" button → opens external support tool URL
(configured via NEXT_PUBLIC_SUPPORT_TOOL_URL env variable)
Brief note: "Support tickets are managed in our external helpdesk.
The in-database ticket schema is reserved for future direct integration."

No API calls required for this section.
═══════════════════════════════════════════════════════════
TESTS
═══════════════════════════════════════════════════════════

Users list renders correctly with search
User detail slide-over opens and shows login history
billing admin sees Financials but not Users
support admin sees Users and Support but not Financials
Financials stale-data notice is always visible
Support page shows external link, no ticket CRUD

Acceptance criteria:

Platform admin can look up any tenant user by email
Login history is visible per user
Financials summary is visible with staleness notice
Support links to external tool (not an in-app ticket UI)
---

## CC-Web Phase 4 Prompt — Automations, Security, Audit, Settings
You are building CC-Web Phase 4 of the Wayfield Command Center frontend.
This is the final CC-Web phase.
CC-Web Phases 1, 2, and 3 must be complete before starting this phase.
Read before writing any code:
@../docs/command_center/NAVIGATION_SPEC.md
@../docs/command_center/COMMAND_CENTER_SCHEMA.md
@../docs/02_domain/ROLE_MODEL.md
@../docs/stabilization/OPEN_QUESTIONS.md
═══════════════════════════════════════════════════════════
PART 1 — Automations
═══════════════════════════════════════════════════════════
Route: /automations (super_admin, admin only)
API: GET /api/platform/v1/automations (or per-org automation endpoints)
Important context to display prominently on this screen:
"Automation rules can be created and configured here. The automation
execution engine (the process that fires rules automatically) has not
yet been implemented. Rules created here will not execute until the
engine is built. See OPEN_QUESTIONS Q8."
Automations List:

Columns: organisation, name, trigger, action, status (active/inactive), last run
Filter by organisation, trigger type, status
Create Rule button → opens rule editor

Rule Editor (create/edit slide-over or modal):

Organisation selector
Rule name
Trigger selector (dropdown of available trigger types)
Trigger conditions (JSON editor or structured fields)
Action selector (dropdown of available action types)
Action config (fields vary by action type)
Active toggle
Save button → calls POST or PATCH endpoint

No execution controls (no "Run Now" button) — the engine doesn't exist yet.
═══════════════════════════════════════════════════════════
PART 2 — Security Events
═══════════════════════════════════════════════════════════
Route: /security
API: GET /api/platform/v1/security/events
Table:

Columns: date/time, organisation, user, event_type, severity badge
Severity badges: LOW (grey), MEDIUM (blue), HIGH (amber), CRITICAL (coral/red)
Filter by severity, event_type, date range, organisation

No mutation actions on this screen — read-only.
═══════════════════════════════════════════════════════════
PART 3 — Platform Audit Log
═══════════════════════════════════════════════════════════
Route: /audit
API: GET /api/platform/v1/audit-logs (platform_audit_logs table)
Table:

Columns: date/time, admin user, organisation, action, entity type, entity ID
Expandable row: shows old_value_json, new_value_json, metadata_json in a
formatted JSON viewer
Filter by admin user, organisation, action, date range

This shows platform admin mutations only — not tenant audit_logs.
Export: CSV export of filtered results (optional stretch goal for this phase).
═══════════════════════════════════════════════════════════
PART 4 — Settings (super_admin only)
═══════════════════════════════════════════════════════════
Route: /settings (super_admin only — redirect other roles to /)
API: various admin management endpoints
Two sections:
Platform Config:
API: GET /api/platform/v1/config

Key-value list of platform_config entries
Edit value inline (PUT endpoint per key)
No delete — platform config keys are fixed

Admin User Management:
API: GET /api/platform/v1/admins
Table:

Columns: name, email, role badge, active status, last login, actions
Actions per row: Edit role, Deactivate
Invite Admin button → modal with email + role selector (cannot invite super_admin)

Edit Role modal:

Role selector (excludes super_admin for non-super_admin actors)
Save → calls PATCH endpoint
Last-super-admin guard: if attempting to demote the last super_admin, show an error

Deactivate:

Confirmation modal
Cannot deactivate self
Cannot deactivate if it would leave no active super_admin

Invite Admin modal:

Email input
Role selector (admin, support, billing, readonly — super_admin cannot be invited,
only promoted via edit)
Send invite → calls POST endpoint (if invite flow exists)
OR create with temporary password (depending on implemented API flow)

═══════════════════════════════════════════════════════════
TESTS
═══════════════════════════════════════════════════════════

Automations screen shows the execution-engine-not-implemented notice
Security events render with severity-coded badges
Audit log expandable row shows formatted JSON metadata
Settings route redirects admin, support, billing, readonly roles to /
Cannot deactivate self in admin user management
Last-super-admin guard prevents demoting the final super_admin — error shown
Audit log entries from platform_audit_logs (not tenant audit_logs)

Acceptance criteria:

Automation rules can be created but execution notice is prominent
Security events are readable with severity filtering
Platform audit log is browsable with metadata expansion
Settings is accessible only to super_admin
Admin user management respects last-super-admin constraint
All mutations produce visible confirmation/error feedback