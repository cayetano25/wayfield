# Unified User Account Model
## docs/02_domain/UNIFIED_USER_ACCOUNT.md

**Source authority:** `MASTER_PROMPT.md` Constitutional Rule 5.
**Role authority:** `ROLE_MODEL.md`
**Implementation guide:** `docs/06_implementation/UNIFIED_USER_ACCOUNT_PLAN.md`

---

## Core Principle

**One `users` record. All roles. Context-determined.**

A person in Wayfield registers once, with one email address and one password.
That single `users` record is their permanent identity. It does not change type.
It is not replaced when they take on a new role. It is not duplicated.

A person who signs up as a participant and later creates their own organisation
has the same account. A photography instructor who leads workshops for multiple
organisations has one account. A platform user who is simultaneously a participant
in one workshop, a leader in another, and an admin of their own organisation has
one account.

Role is derived from relationships — not from any field on the `users` table.

---

## Why This Principle Exists

Without a unified account model:
- A person needs separate logins for each context they hold.
- Data about the person is fragmented across tables by role.
- When someone's role changes, account migration is required.
- The system cannot model a person who legitimately holds multiple roles at once.

With a unified account model:
- One email, one password, one account — always.
- Role contexts are additive. Gaining a new role does not disturb existing ones.
- A single Sanctum token grants access to all contexts the account holds.
- The API resolves the applicable context per-request from the database.

---

## How Role Is Stored

Role is never stored on the `users` table. It is stored in relationship tables:

| Role Context | Table | Field |
|---|---|---|
| Participant | `registrations` | Exists for the workshop in context |
| Leader | `leaders.user_id` + `leader_invitations.status` + `session_leaders` | Linked, accepted, assigned |
| Organisation member | `organization_users.role` | `owner`, `admin`, `staff`, `billing_admin` |

The absence of a row means the role does not apply in that context. There is no
"participant" or "leader" value anywhere on the `users` table.

---

## How the API Resolves Role

For every authenticated request, the API resolves the user's applicable role
by querying the relevant relationship for the resource being accessed:
Is the user authenticated? (auth:sanctum)
Is the user's email verified? (where required)
What resource is being accessed? (org, workshop, session, leader resource?)
Does the user have an organization_users row for this org?
→ If yes: apply org role (owner/admin/staff/billing_admin)
Does the user have a leaders record linked for this session (via session_leaders)?
→ If yes, and no org role applies: apply leader access scope
Does the user have a registrations row for this workshop?
→ If yes, and neither org role nor leader scope applies: apply participant access
Specific business rule check (capacity, time window, plan gate)

Organisation role (step 4) takes precedence over leader scope (step 5). A user who
is both an `admin` of an organisation and a leader invited to one of its workshops
accesses the system with their admin permissions — the more permissive role applies
for org-level resources.

Role claims from clients are never trusted. The database is always the source of truth.

---

## Additive Role Contexts

Role contexts are additive and independent. Holding one does not exclude another.

Examples of valid simultaneous contexts:

| `users.id` | Participant context | Leader context | Organisation context |
|---|---|---|---|
| User 42 | Registered in Workshop A (Org X) | Assigned to Session 5 (Org Y) | `admin` of Org Z |
| User 17 | Registered in Workshops B and C | — | `owner` of Org W |
| User 88 | — | Assigned to Session 9 (Org X) | — |
| User 31 | Registered in Workshop D | — | `billing_admin` of Org X |

Each context is resolved independently per-request. There is no bleed between them.

---

## Role Transitions

The following are common paths by which a user gains a new role context. In every
case, the existing account is used — no new account is created.

### Gaining Participant Context

A user joins a workshop via a join code. `JoinWorkshopByCodeAction` creates a
`registrations` row for the user and workshop. The user now has participant access
to that workshop. Their prior contexts are unaffected.

### Gaining Leader Context

1. An organiser invites a leader by email.
2. A `leader_invitations` row is created (status = `pending`).
3. The invited person clicks the link in the invitation email.
4. **If they have an existing account:** they log in; `AcceptLeaderInvitationAction`
   creates or links a `leaders` record to their `users.id`, creates an
   `organization_leaders` row, and sets invitation status to `accepted`.
5. **If they do not have an account:** the acceptance flow includes account creation;
   after registering, the same action runs.
6. The organiser then assigns the leader to sessions via `AttachLeaderToSessionAction`,
   creating `session_leaders` rows.
7. The user now has leader access to those sessions. All prior contexts are unaffected.

Note: A `leaders` record can exist before it is linked to a `users` account (the leader
has been invited but not yet accepted). `leaders.user_id` is nullable until acceptance.

### Gaining Organisation Member Context

1. An organisation `owner` or `admin` invites a person to join the organisation with
   a specific role (`admin`, `staff`, or `billing_admin`).
2. An `organization_invitations` row is created (status = `pending`).
3. The invited person clicks the link in the invitation email.
4. **If they have an existing account:** they log in; an `organization_users` row is
   created with the specified role.
5. **If they do not have an account:** account creation is included in the acceptance
   flow; the `organization_users` row is created after registration.
6. The user now has organisation member access at the specified role level.
   All prior contexts are unaffected.

Note: `owner` role is not granted via invitation. It is transferred via the
ownership transfer action by an existing `owner`.

---

## Organisation Ownership Rules

These rules protect the organisation from being left without an active owner.

- There must always be at least one active `owner` per organisation.
- Removing the last active `owner` is forbidden (`LastOwnerException`).
- Downgrading the last active `owner` to a non-owner role is forbidden.
- These checks are enforced in `RemoveOrganizationMemberAction` and
  `UpdateOrganizationMemberRoleAction` before any mutation occurs.
- The check uses `organization_users` rows where `role = 'owner'` and `is_active = true`.

---

## Cross-Role Scenarios

### Organisation Member Who Is Also a Participant

A user runs their own photography workshop organisation (they are an `owner` of
Organisation A) and also attends a workshop run by Organisation B as a participant.

Their `organization_users` row for Organisation A has no bearing on their participant
experience in Organisation B's workshop. The `registrations` row for the Organisation B
workshop is what grants participant access there. The two contexts are fully independent.

### Participant Who Later Becomes an Organisation Member

A user attends workshops as a participant for months. Later, they are invited to
manage an organisation as `admin`. Their existing `registrations` rows remain intact.
Their participant history is not altered. The new `organization_users` row simply adds
a new context. Nothing migrates; nothing breaks.

### Leader Invited to Multiple Organisations

A photography instructor accepts leader invitations from Organisation A and Organisation
B. The same `leaders` record is linked to both via two separate `organization_leaders`
rows. Their session access in Organisation A's workshops is governed solely by their
`session_leaders` assignments within Organisation A — it has no relation to their
assignments in Organisation B.

### Leader Who Is Also an Organisation Member

A photographer is both a `session_leaders`-assigned leader for a workshop session
AND an `admin` of the organisation that runs the workshop.

When this user accesses organisation admin endpoints, their `admin` role governs.
When they access leader-scoped endpoints (roster for their assigned session), their
leader assignment governs. There is no conflict — these are different endpoint contexts.
The API checks for `organization_users` membership first: if the user has an org role,
that role's permissions apply for org-resource endpoints.

### Organisation Owner Who Is Also a Participant in Another Org's Workshop

They access the participant-facing workshop endpoints using their `registrations` row,
not their `organization_users` membership. Their ownership of their own organisation
grants them no additional access to a different organisation's workshop. Cross-tenant
data leakage in this scenario is a critical failure.

---

## What Is Prohibited

The following patterns contradict the unified account model and are not permitted:

- A `user_type` or `account_type` field on the `users` table
- Separate login flows per role (e.g., a separate "leader login" page)
- Separate account tables per role (e.g., a `participant_accounts` table)
- Role stored directly on `users` (e.g., `users.role = 'leader'`)
- Forcing a person to create a second account to access a different context
- Any architecture that requires account migration when a person's role changes

---

## Relationship to ROLE_MODEL.md

This document defines the **principle** that one account serves all roles and explains
how role contexts are established and resolved.

`ROLE_MODEL.md` defines the **taxonomy** — what each role can and cannot do, what
stored values represent each role, and the enforcement pattern.

Both documents are required reading. They are complementary, not redundant.