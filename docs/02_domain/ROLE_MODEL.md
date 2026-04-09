# Wayfield — Canonical Role Model
## docs/02_domain/ROLE_MODEL.md — v1.1

**Authority:** This document supersedes the role sections of
`PERMISSIONS_AND_PRIVACY_MODEL.md`, `MASTER_PROMPT.md` Core Roles section,
and `permissions_matrix.md` (deprecated) wherever they conflict.

**Ground truth:** The stored enum values in `organization_users.role` and
`admin_users.role` are the canonical role identifiers. All documentation
and code must use these exact strings.

---

## 0. Unified User Account Principle

**One `users` record. All roles. Context-determined.**

This is a constitutional rule of the Wayfield system.

A person uses a single email address and password regardless of how many
organisations they manage, how many workshops they lead, or how many workshops
they attend as a participant. There is no separate "participant account",
"leader account", or "organiser account". There is one account.

Role is **not** a property of the `users` record. Role is a property of the
**relationship** a user holds in a given context. The same `users.id` can
simultaneously hold:

- **Participant context** — has a `registrations` row for Workshop A
- **Leader context** — has a `leaders` record linked via `leaders.user_id`,
  an accepted `leader_invitations` row, and a `session_leaders` assignment for Workshop B
- **Organisation member context** — has an `organization_users` row with
  `role = 'admin'` for Organisation C

All three contexts are resolved per-request, per-resource, from the database.
Role claims from clients are never trusted. No field on the `users` table
encodes a global role.

For the full model including role transitions, invitation flows, cross-role
scenarios, and the organisation member invitation process, see:
`docs/02_domain/UNIFIED_USER_ACCOUNT.md`

---

## 1. The Two Identity Systems

Wayfield has two completely isolated identity systems that never intersect.

### Tenant Identity System

Stored in the `users` table. Serves participants, leaders, and organisation members.
Authenticated via `auth:sanctum` middleware.
Tokens stored in `personal_access_tokens` with
`tokenable_type = 'App\Models\User'`.
Accesses routes under `/api/v1/*` only.

### Platform Identity System

Stored in the `admin_users` table. Serves Wayfield employees only.
Authenticated via `auth:platform_admin` middleware.
Tokens stored in `personal_access_tokens` with
`tokenable_type = 'App\Models\AdminUser'`.
Accesses routes under `/api/platform/v1/*` only.

**These systems are mutually exclusive.**
A tenant token MUST be rejected on platform routes.
A platform token MUST be rejected on tenant routes.
This must be enforced by middleware on every route — never by convention.

---

## 2. Tenant Role Taxonomy

A user's effective role depends on context. The same user can be a participant
in one workshop and an admin in a different organisation. Role is not a property
of the user — it is a property of the relationship, resolved per-request.

---

### 2.1 Participant

**How identified:**
User has a `registrations` row for the workshop in context.
The user may or may not have an `organization_users` row; if they do, their org
role governs org-level actions, but their participant status governs workshop
participation actions independently.

**Stored where:** Not stored as a role value. Derived from `registrations`.

**Capabilities:**
- Join workshops via join code
- Select sessions (session-based workshops)
- View personal schedule
- Self check-in to sessions
  - Session-based: requires both registration and session selection
  - Event-based: requires registration only
- View workshop overview, logistics, and public leader summaries
- Receive notifications
- Access workshop data offline via mobile app (meeting URLs excluded from sync)

**Cannot:**
- View other participants' contact details or phone numbers
- View rosters of any kind
- Send notifications of any kind
- Access any administrative functions

---

### 2.2 Leader

**How identified:**
User has a linked `leaders` record via `leaders.user_id`.
Leader has accepted an invitation (`leader_invitations.status = 'accepted'`).
Leader is assigned to the session in context via `session_leaders`.

**Stored where:** `leaders.user_id` links identity. `leader_invitations.status`
tracks acceptance. `session_leaders` tracks session-level assignment.
`session_leaders.assignment_status` must be `accepted` for operational access.

A leader can exist WITHOUT a user account (invited but not yet registered).
A leader WITH a user account can simultaneously be a participant in other
workshops and/or an organisation member.

**Capabilities (all scoped to assigned sessions only):**
- Accept or decline invitations
- Complete and maintain own leader profile
- View assigned workshops and sessions
- View roster for assigned sessions only
- See participant phone numbers for assigned sessions only
- Check in participants manually
- Mark participants as no-show
- Override attendance status
- Send notifications (constrained — see Section 3)

**Cannot:**
- Access sessions they are not assigned to
- See rosters or participant data for unassigned sessions
- Send notifications outside the approved scope or time window
- Access any organisational administrative functions

---

### 2.3 Organisation Member Roles

A user with an `organization_users` row has organisational access.
The `role` enum determines their capability level.

**Stored where:** `organization_users.role`
**Valid values:** `owner`, `admin`, `staff`, `billing_admin`

---

#### `owner`

The account that created the organisation, or someone explicitly granted owner
status via an ownership transfer. There must always be at least one active owner
per organisation. Removing or downgrading the last active owner is forbidden.

**Full capabilities:**
All workshop operations, session management, leader management (invite, assign,
remove), participant management, notification sending (all scopes), attendance
oversight, organisation settings, member management (including adding, changing
roles, and removing any member including other owners), billing and subscription
management, ownership transfer.

**Unique to `owner`:**
- Can demote or remove other `owner`-role users
- Can delete the organisation
- Is the billing contact by default
- Can initiate ownership transfer

---

#### `admin`

Full operational access. Cannot modify `owner`-role accounts or delete the organisation.

**Capabilities:**
All workshop operations, session management, leader management (including inviting
leaders), participant management, notification sending (all scopes), attendance
oversight, organisation settings, member management (can add/remove `staff` and
`billing_admin`; cannot demote or remove `owner` or other `admin` accounts).

**Billing:** Read-only view — can see plan and subscription status but cannot
change the subscription or manage payment methods.

---

#### `staff`

Operational access for day-to-day workshop management. No administrative or
billing access.

**Capabilities:**
Create and edit workshops, manage sessions and tracks, manage locations, manage
logistics, view and manage participants, add/remove participants from sessions,
manage attendance, view roster (including participant phone numbers), send workshop
and session notifications, view reports.

**Cannot:**
Invite leaders (requires `admin` or `owner`), access or modify organisation
settings, manage organisation members, view or manage billing in any form,
send org-wide notifications beyond workshop scope.

---

#### `billing_admin`

Billing access only. No operational access to workshops, participants, or reports.

**Capabilities:**
View organisation name and contact information (read-only), view subscription plan
and status, view invoices and billing history, access Stripe billing portal, manage
payment methods.

**Cannot:**
View workshops, sessions, participants, leaders, attendance records, or reports.
Send notifications of any kind. Access organisation settings beyond billing.
Manage organisation members. Invite anyone.

---

## 3. Leader Messaging Constraint (Canonical)

This constraint is enforced at the backend and is not plan-configurable.
The plan gate controls whether leader notifications are accessible at all —
the constraint always applies when the feature is enabled.

**Scope constraint:**
Leaders may only send notifications to participants enrolled in sessions
they are explicitly assigned to via `session_leaders`.
The `notification.session_id` field is required for all leader-created
notifications and must reference an assigned session.

**Time window constraint:**
Notifications are accepted only within this window:
- Opens: 4 hours before `session.start_at` (in the session's parent workshop timezone)
- Closes: 2 hours after `session.end_at` (in the session's parent workshop timezone)

All timezone calculations must use the parent workshop's `timezone` field,
not UTC and not the server's local timezone.

**Plan gate:**
Leader-to-participant notifications require Starter plan or higher.
On the Free plan, leader notification endpoints return HTTP 403 with:
```json
{ "error": "plan_required", "required_plan": "starter" }
```

**Enforcement layers (all three are required):**
1. Backend service validates assignment, scope, and time window before
   creating the notification record (`EnforceLeaderMessagingRulesService`)
2. UI hides the notification compose interface outside the valid window
3. All leader notifications write to `audit_logs` regardless of outcome

---

## 4. Role Mapping: Conceptual to Stored

When any document, comment, or code uses conceptual role terms, apply these
authoritative mappings. In all code, use the stored enum values — never conceptual labels.

| Conceptual Term | Stored Role(s) | Notes |
|---|---|---|
| "organiser" | `owner`, `admin`, `staff` | All three org management roles collectively |
| "full organiser" / "org admin" | `owner`, `admin` | Excludes `staff` and `billing_admin` |
| "owner only" | `owner` | Strictly the owner role |
| "management" / "elevated" | `owner`, `admin` | Actions requiring elevated trust |
| "operational staff" | `owner`, `admin`, `staff` | All who can touch workshop operations |
| "billing access" | `owner`, `billing_admin` | Both have billing rights |
| "leader" | (derived) | `leaders.user_id` match + invitation accepted + session assigned |
| "participant" | (derived) | `registrations` match for the workshop in context |
| "platform admin" | `super_admin`, `admin`, `support`, `billing`, `readonly` | `admin_users` only |

**Important note on "organiser":** When a specific capability check says "organiser can
do X", the code must check which stored roles can actually do X — typically `owner` and
`admin`, sometimes `staff`. The conceptual term alone is never sufficient for a policy.

**When writing new permission checks:**
Always use the stored enum values. Document which stored roles are included
in a comment directly above the check:

```php
// Allowed: owner, admin
// Denied: staff, billing_admin
public function inviteLeader(User $user, Organization $organization): bool
{
    $role = $organization->memberRole($user);
    return in_array($role, ['owner', 'admin'], true);
}
```

---

## 5. Cross-Role Scenarios

These scenarios occur in production and must be handled correctly in all policies.

### Scenario A: Organisation Member Who Is Also a Participant

A workshop photographer runs their own workshops (they are an `owner` of their
organisation) and also attends another organisation's workshop as a participant.

**Handling:** Role is determined by context. Their `organization_users` membership
in their own org has no bearing on their participant experience in an unrelated
workshop. The `registrations` row for the external workshop is what grants participant
access there. No cross-context leakage.

### Scenario B: Leader Invited to Multiple Organisations

A photography instructor has accepted invitations from both Organisation A and
Organisation B. The same `leaders` record (and the same `users` record) is linked
to both via separate `organization_leaders` rows.

**Handling:** Session access is scoped to the sessions they are assigned to within
each organisation's workshops independently via `session_leaders`. They cannot access
Organisation A's session data through their Organisation B assignment.

### Scenario C: Staff User Viewing a Workshop They Did Not Create

A staff user can view and edit all workshops in their organisation, not just those
they personally created. Workshop ownership is at the organisation level.

**Handling:** The `workshop.organization_id` check is sufficient. There is no
per-user workshop ownership field. All staff members of an organisation share
equal operational access to all workshops in that organisation.

### Scenario D: Leader Who Is Also an Organisation Member

An instructor is both a leader (accepted invitation, session assigned) AND an
`admin` of the organisation that runs the workshop.

**Handling:** Their `admin` role grants the broader set of permissions. The
leader-scoped restrictions do not apply when they are acting in the admin context.
The API checks for `organization_users` membership first — if the user has an
org role, they access resources with their org role permissions.

### Scenario E: Participant Who Later Becomes an Organisation Member

A user joins workshops as a participant for some time, then later creates their own
organisation (or is invited to manage an existing one).

**Handling:** No account migration. The existing `users` record gains a new
`organization_users` row. All prior `registrations` and participant history remain
intact and are unaffected. The same Sanctum token continues to work across both contexts.

---

## 6. Permission Enforcement Pattern

All permission checks in controllers must follow this order:
Authentication check           middleware: auth:sanctum
Email verification check       middleware: verified, where required
Tenant membership check        Does this user have an organization_users row for this org?
(Or is this a public/participant endpoint?)
Role check                     What role does this user have? (Query DB — never trust client)
Resource ownership check       Does this resource belong to this org?
Specific business rule check   Capacity, time window, plan gate, etc.

Never skip steps. Never rely on UI-level hiding as a substitute for backend enforcement.
Step 4 must always read from the database — never from a cached or client-provided claim.

---

## 7. Platform Admin Role Taxonomy

Platform roles are entirely separate from tenant roles.
Stored in `admin_users.role`.

| Role | Can | Cannot |
|---|---|---|
| `super_admin` | Everything including managing other admins | — |
| `admin` | Full platform access | Manage `super_admin` accounts |
| `support` | Read all tenant data, manage support tickets | Billing, feature flags |
| `billing` | Read all, manage billing and plan changes | Feature flags, admin management |
| `readonly` | View only across all platform sections | All mutations |

**Platform admins can read all tenant data** for support and oversight purposes.

**Platform admins can only mutate tenant data through explicitly defined platform actions:**
- Feature flag overrides: `POST /api/platform/v1/organizations/{org}/feature-flags`
- Plan changes: `POST /api/platform/v1/organizations/{org}/billing/plan`
- System announcements: platform announcement endpoints

Every platform admin mutation writes to `platform_audit_logs`. No exceptions.