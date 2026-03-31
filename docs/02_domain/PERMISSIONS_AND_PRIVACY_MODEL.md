# Permissions and Privacy Model

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
Role DB values: `DATA_SCHEMA_FULL.md` Table 8 (`organization_users.role`)
This file is the domain spec source of truth for authorization and privacy.

---

## Conceptual Roles

The system defines four conceptual roles used throughout the permission model:

1. **Participant** — end user attending a workshop
2. **Leader** — invited facilitator managing assigned sessions
3. **Organizer** — organization staff managing workshops and participants
4. **Organization Admin** — full organization management including billing

---

## Organizer → Database Role Mapping

IMPORTANT: The conceptual role "Organizer" does not exist as a DB value.
Authorization policies must resolve conceptual roles to `organization_users.role` values.

| Conceptual Role | `organization_users.role` Value(s) | Notes |
|---|---|---|
| Full Organizer/Admin | `owner`, `admin` | Full workshop management, notifications, reports, leader management |
| Staff Organizer | `staff` | Can view workshops and sessions, manage attendance; cannot manage billing, invite leaders, or send org-wide notifications |
| Billing Admin | `billing_admin` | Billing and subscription actions only; no workshop or participant access |
| Leader | Not in `organization_users` | Leaders are in the `leaders` table, linked via `organization_leaders` |
| Participant | Not in `organization_users` | Participants have no organization membership row |

Policy classes must gate "organizer-level" actions on `role IN ('owner', 'admin')`.
`staff` receives a defined subset — see the matrix below.

---

## Participant Permissions

Can:
- register and log in on web and mobile
- verify email
- manage own profile and preferences
- join workshops using a join code
- view workshop overview and hotel/logistics info
- view sessions and leaders (public-safe fields only)
- select sessions in session-based workshops
- view personal schedule
- self-check-in
- receive email and push notifications
- use downloaded workshop data offline

Cannot:
- see other participants' phone numbers or contact details
- see rosters of any kind
- manage workshops, sessions, or leaders
- message other participants

---

## Leader Permissions

Can:
- receive invitation email
- accept or decline workshop/session participation
- complete and edit their own leader profile
- view assigned workshops and sessions
- view roster for assigned sessions only
- see participant phone numbers for their assigned sessions only
- monitor participant self-check-in status
- check in participants manually (assigned sessions only)
- mark no-show (assigned sessions only)
- override attendance for assigned sessions only
- send notifications only within approved constraints (see messaging constraints below)

Cannot:
- access rosters for unassigned sessions
- see private participant data beyond assigned operational scope
- message participants outside the approved scope/window
- view other leaders' assigned session details

### Leader Messaging Constraints (Critical — Backend Enforcement Required)

Scope:
- ONLY participants who are registered and selected into the leader's assigned session

Time Window:
- 4 hours before session `start_at` (computed in workshop timezone)
- through session runtime
- until 2 hours after session `end_at` (computed in workshop timezone)

Enforcement:
- backend business rules are MANDATORY (see `NOTIFICATIONS_AND_MESSAGING_SYSTEM.md`)
- UI visibility controls are supplementary
- audit logging is MANDATORY for all leader-sent notifications

---

## Organizer Permissions (`owner`, `admin` roles)

Can:
- create and manage organizations
- manage organization contacts
- add and manage organization members and their roles
- create, edit, publish, and archive workshops
- manage sessions, tracks, locations, and hotel/logistics info
- set optional capacities for sessions and events
- invite and manage leaders
- view leader invitation status
- assign leaders to sessions
- send notifications to any scope (all participants, leaders, session-specific)
- view full attendance and reports
- view full roster including participant phone numbers
- manage subscription and feature access
- manage public workshop page content

---

## Organization Admin Permissions (all of above, plus)

`owner` role adds:
- manage organization billing and subscription
- transfer organization ownership
- deactivate or remove organization members

`billing_admin` role (billing scope only):
- view and manage subscription and invoices
- no workshop or participant access

---

## Staff Permissions (`staff` role)

`staff` is a limited Organizer scope:
- view workshops and sessions (no create/edit/publish/archive)
- manage attendance for sessions
- view roster (with phone number access)
- cannot manage leaders or invitations
- cannot send org-wide notifications
- cannot manage billing or organization members

---

## Quick Reference Permissions Matrix

| Action | Participant | Leader | Staff | Organizer (owner/admin) |
|---|---|---|---|---|
| Register / log in | ✅ | ✅ | ✅ | ✅ |
| Join workshop by code | ✅ | — | — | — |
| Select sessions | ✅ | — | — | — |
| Self-check-in | ✅ | — | — | — |
| View own schedule | ✅ | ✅ | — | — |
| View logistics / hotel info | ✅ | ✅ | ✅ | ✅ |
| View roster (assigned session) | — | ✅ | ✅ | ✅ |
| View roster (all sessions) | — | — | ✅ | ✅ |
| See participant phone numbers | — | ✅ (assigned) | ✅ | ✅ |
| Manual check-in / no-show | — | ✅ (assigned) | ✅ | ✅ |
| Send notification (constrained) | — | ✅ | — | — |
| Send notification (broad) | — | — | — | ✅ |
| Create / manage workshops | — | — | — | ✅ |
| Manage sessions / tracks | — | — | — | ✅ |
| Invite leaders | — | — | — | ✅ |
| Manage organization members | — | — | — | ✅ (owner/admin) |
| Manage billing | — | — | — | ✅ (owner/billing_admin) |
| View reports | — | — | ✅ (limited) | ✅ |

---

## Privacy Rules

### Participant Phone Numbers
- Visible ONLY to:
  - leaders assigned to the participant's session
  - organization members with `owner`, `admin`, or `staff` roles
- Never visible to:
  - other participants
  - unrelated leaders
  - public endpoints

### Leader Address Privacy
- `address_line_1`, `address_line_2`, `postal_code`, `country` are private
- Public APIs expose ONLY: `city`, `state_or_region`
- Full address visible only to the leader themselves and organization `owner`/`admin`

### Public Leader Visibility
Safe fields for public/participant workshop pages:
- `first_name`, `last_name`
- `display_name` (if present)
- `profile_image_url`
- `bio` (snippet — full bio acceptable)
- `website_url`
- `city`
- `state_or_region`

Never expose publicly:
- `email`
- `phone_number`
- `address_line_1`, `address_line_2`, `postal_code`, `country`

### Meeting Links
- `meeting_url`, `meeting_id`, `meeting_passcode` are NEVER in public workshop endpoints
- Visible only to authenticated registered participants (and org staff+)
- Participant-facing interfaces must show a "Join Meeting" action for virtual/hybrid sessions

### Roster Data
- Participants cannot view any roster
- Leaders can view roster only for their assigned sessions
- Unrelated leaders must not receive any participant data
