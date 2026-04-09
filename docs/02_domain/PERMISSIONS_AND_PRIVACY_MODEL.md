# Permissions and Privacy Model
## docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Role DB values: `DATA_SCHEMA_FULL.md` Table 8 (`organization_users.role`).
Role taxonomy authority: `ROLE_MODEL.md` (supersedes this document on role definitions).
This file is the domain spec source of truth for the permission matrix and privacy rules.

---

## Conceptual Roles and Their DB Mappings

The system defines roles at two levels: conceptual (for human communication) and stored
(for policy enforcement in code). Code must always use stored values.

**IMPORTANT:** The conceptual role "Organiser" is not a stored DB value.
Authorization policies must resolve conceptual roles to `organization_users.role` values.

| Conceptual Role | `organization_users.role` value(s) | Notes |
|---|---|---|
| Full Organiser / Admin | `owner`, `admin` | Full workshop management, notifications, reports, leader management |
| Staff Organiser | `staff` | Workshop/session management, attendance, roster with phone access; no billing, no leader invitations |
| Billing Admin | `billing_admin` | Billing portal only; no workshop or participant access |
| Leader | Not in `organization_users` | Derived from `leaders.user_id` + accepted invitation + `session_leaders` |
| Participant | Not in `organization_users` | Derived from `registrations` for the workshop in context |

Policy classes that gate "organiser-level" actions must check `role IN ('owner', 'admin')`.
Policy classes that include staff in an action must check `role IN ('owner', 'admin', 'staff')`.
`billing_admin` must be explicitly denied from every non-billing endpoint.

---

## Participant Permissions

A participant is any user with a `registrations` row for the workshop in context.

**Can:**
- Register and log in on web and mobile
- Verify email
- Manage own profile and preferences
- Join workshops using a join code
- View workshop overview and hotel/logistics info
- View sessions and public-safe leader profiles
- Select sessions in session-based workshops
- View personal schedule
- Self check-in
  - Session-based workshops: requires both registration and session selection
  - Event-based workshops: requires registration only
- Receive email and push notifications
- Use downloaded workshop data offline

**Cannot:**
- View other participants' phone numbers or contact details
- View rosters of any kind
- Manage workshops, sessions, or leaders
- Send notifications of any kind

---

## Leader Permissions

A leader is a user with an accepted invitation and an active `session_leaders`
assignment (`assignment_status = 'accepted'`). All capabilities are scoped to
assigned sessions only.

**Can:**
- Accept or decline invitations
- Complete and edit their own leader profile
- View assigned workshops and sessions
- View roster for assigned sessions only
- See participant phone numbers for their assigned sessions only
- Monitor participant self check-in status
- Check in participants manually (assigned sessions only)
- Mark no-show (assigned sessions only)
- Override attendance status (assigned sessions only)
- Send notifications (constrained — see Leader Messaging Constraints below)

**Cannot:**
- Access rosters for unassigned sessions
- See private participant data beyond assigned operational scope
- Message participants outside the approved scope or time window
- View other leaders' assigned session details
- Access any organisational administrative functions

### Leader Messaging Constraints (Critical — Backend Enforcement Required)

**Scope:** Only participants who are registered and have selected (or are enrolled
in) the leader's specifically assigned session.

**Time window:**
- Opens: 4 hours before `session.start_at` (in the parent workshop's timezone)
- Closes: 2 hours after `session.end_at` (in the parent workshop's timezone)

**Enforcement layers (all required):**
1. `EnforceLeaderMessagingRulesService` validates assignment, scope, and window
   before creating the notification record
2. UI hides the notification compose interface outside the valid window
3. All leader notifications write to `audit_logs` regardless of outcome

**Plan gate:** Starter plan or higher required. Free plan returns HTTP 403.

See `ROLE_MODEL.md` Section 3 for the full canonical constraint definition.

---

## Organiser Permissions — `owner` and `admin` roles

**Can:**
- Create and manage organisations
- Manage organisation contacts
- Add and manage organisation members and their roles
- Create, edit, publish, and archive workshops
- Manage sessions, tracks, locations, and hotel/logistics info
- Set optional capacities for sessions and events
- Invite and manage leaders
- View leader invitation status
- Assign leaders to sessions
- Send notifications to any scope (all participants, leaders, session-specific)
- View full attendance and reports
- View full roster including participant phone numbers
- Manage subscription and feature access
- Manage public workshop page content

**`owner` additionally can:**
- Manage billing and subscription
- Transfer organisation ownership
- Demote or remove other `owner`-role members
- Delete the organisation

**`admin` billing note:** `admin` has read-only view of billing (plan status). Cannot
change the subscription or manage payment methods.

---

## Staff Permissions — `staff` role

**Can:**
- Create and edit workshops
- Manage sessions, tracks, locations, and logistics
- View and manage participants
- Add/remove participants from sessions
- Manage attendance for sessions
- View roster (with participant phone number access)
- Send workshop and session notifications
- View reports (limited to operational data)

**Cannot:**
- Invite leaders (requires `owner` or `admin`)
- Manage organisation settings
- Manage organisation members
- View or manage billing in any form
- Send org-wide notifications

---

## Billing Admin Permissions — `billing_admin` role

**Can:**
- View organisation name and contact info (read-only)
- View subscription plan and status
- View invoices and billing history
- Access Stripe billing portal
- Manage payment methods

**Cannot:**
- View workshops, sessions, participants, leaders, attendance, or reports
- Send notifications of any kind
- Access organisation settings beyond billing context
- Manage organisation members

---

## Quick Reference Permissions Matrix

| Action | Participant | Leader | Staff | Admin / Owner |
|---|---|---|---|---|
| Register / log in | ✅ | ✅ | ✅ | ✅ |
| Join workshop by code | ✅ | — | — | — |
| Select sessions | ✅ | — | — | — |
| Self check-in | ✅ | — | — | — |
| View own schedule | ✅ | ✅ | — | — |
| View logistics / hotel info | ✅ | ✅ | ✅ | ✅ |
| View roster (assigned session) | — | ✅ | ✅ | ✅ |
| View roster (all sessions) | — | — | ✅ | ✅ |
| See participant phone numbers | — | ✅ (assigned) | ✅ | ✅ |
| Manual check-in / no-show | — | ✅ (assigned) | ✅ | ✅ |
| Send notification (constrained) | — | ✅ | — | — |
| Send notification (broad) | — | — | ✅ (workshop scope) | ✅ |
| Create / manage workshops | — | — | ✅ | ✅ |
| Manage sessions / tracks | — | — | ✅ | ✅ |
| Invite leaders | — | — | — | ✅ (owner/admin) |
| Invite org members | — | — | — | ✅ (owner/admin) |
| Manage organisation members | — | — | — | ✅ (owner/admin) |
| View billing (read-only) | — | — | — | ✅ (admin/owner) |
| Manage billing | — | — | — | ✅ (owner, billing_admin) |
| View reports | — | — | ✅ (limited) | ✅ |

---

## Privacy Rules

### Participant Phone Numbers

Participant phone numbers (`users.phone_number` and any phone in roster data)
are subject to strict visibility rules.

**Visible to:**
- Leaders assigned to the participant's session (via `session_leaders`)
- Organisation members with `owner`, `admin`, or `staff` roles

**Never visible to:**
- Other participants
- Leaders not assigned to the session in question
- Public endpoints of any kind
- `billing_admin` role

**Enforcement:** `RosterParticipantResource` applies this conditionally.
The `BuildSessionRosterService` also enforces scope at query time.

### Leader Address Privacy

Leader address fields (`address_line_1`, `address_line_2`, `postal_code`, `country`)
are private in all circumstances.

**Public APIs expose only:** `city`, `state_or_region`

**Full address visible only to:** the leader themselves, and organisation `owner`/`admin`.

### Public Leader Visibility

Safe fields for public and participant-facing workshop pages:
- `first_name`, `last_name`
- `display_name` (if present)
- `profile_image_url`
- `bio` (snippet — full bio is acceptable)
- `website_url`
- `city`
- `state_or_region`

**Never expose publicly:**
- `email`
- `phone_number`
- `address_line_1`, `address_line_2`, `postal_code`, `country`

### Meeting Links

`meeting_url`, `meeting_id`, and `meeting_passcode` are never included in:
- Fully public workshop or session endpoints
- Offline sync packages

**Visible only to:** authenticated registered participants (and org `owner`/`admin`/`staff`).

Participant-facing interfaces must show a "Join Meeting" action for sessions where
`delivery_type = 'virtual'` or (`delivery_type = 'hybrid'` and
`virtual_participation_allowed = true`).

### Roster Data

- Participants cannot view any roster
- Leaders can view roster only for their assigned sessions
- Unrelated leaders must not receive any participant data
- `billing_admin` cannot view rosters or any participant data