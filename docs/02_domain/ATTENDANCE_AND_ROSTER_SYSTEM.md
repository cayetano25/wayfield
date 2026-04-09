# Attendance and Roster System Specification
## docs/02_domain/ATTENDANCE_AND_ROSTER_SYSTEM.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Canonical schema: `DATA_SCHEMA_FULL.md` Table 22 (`attendance_records`).
Role authority: `docs/02_domain/ROLE_MODEL.md`.

---

## Attendance Entity

**Table: `attendance_records`** — see `DATA_SCHEMA_FULL.md` Table 22.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `session_id` | BIGINT FK | required |
| `user_id` | BIGINT FK | required |
| `status` | ENUM | `not_checked_in`, `checked_in`, `no_show` |
| `check_in_method` | ENUM nullable | `self`, `leader` |
| `checked_in_at` | DATETIME nullable | timestamp of check-in action |
| `checked_in_by_user_id` | BIGINT FK nullable | the user who performed the check-in, if not self |
| `created_at`, `updated_at` | DATETIME | |

**Data integrity:** One attendance record per `(session_id, user_id)` pair.
Duplicate rows are not permitted.

---

## Core Features

- Participant self-check-in
- Leader manual check-in
- Leader no-show marking
- Leader attendance override
- Organiser add participant to session (Phase 14)
- Organiser remove participant from session (Phase 14)
- Organiser attendance visibility across all sessions
- Role-aware roster access

---

## Self Check-In Rules

**Prerequisites vary by workshop type:**

### Session-based workshops
The participant must:
- have a `registrations` row for the workshop with `registration_status = 'registered'`
- have a `session_selections` row for the session with `selection_status = 'selected'`

Both conditions are required. Registration alone is not sufficient for
session-based check-in.

### Event-based workshops
The participant must:
- have a `registrations` row for the workshop with `registration_status = 'registered'`

Session selection is not required. Registration alone is sufficient.

**On successful self check-in:**
- `attendance_records.status` is set to `checked_in`
- `check_in_method` is set to `self`
- `checked_in_at` is recorded
- `checked_in_by_user_id` is null (self check-in has no actor)
- `audit_logs` entry is written

---

## Leader Check-In and No-Show Rules

**Prerequisites:**
- The leader must have a `session_leaders` row for the session.
- `session_leaders.assignment_status` must be `accepted`.
- A leader with `assignment_status = 'pending'` or `'declined'` does not have
  operational access to check-in or no-show functions for that session.

**Leader can:**
- Mark a participant as `checked_in` (from any status)
- Mark a participant as `no_show` (from any status)
- Override an existing `checked_in` status to `no_show`, or vice versa

**On leader check-in:**
- `check_in_method` is set to `leader`
- `checked_in_at` is recorded
- `checked_in_by_user_id` is set to the leader's `users.id`
- `audit_logs` entry is written

**On leader no-show marking:**
- `status` is set to `no_show`
- `checked_in_by_user_id` is set to the leader's `users.id`
- `audit_logs` entry is written

---

## Organiser Session Participant Management (Phase 14)

Organisation members with `owner`, `admin`, or `staff` roles may add and remove
registered participants from specific sessions directly.

### Add Participant to Session

**Endpoint:** `POST /api/v1/workshops/{workshop}/sessions/{session}/participants`

**Behaviour:**
- Validates the user is registered for the workshop
- Validates capacity would not be exceeded (uses the same capacity enforcement
  as session selection — `SELECT … FOR UPDATE`)
- If a canceled `session_selections` row exists for this user/session, it is
  re-activated rather than creating a duplicate row
- Creates an `attendance_records` row with `status = 'not_checked_in'` if one
  does not already exist
- Writes `audit_logs` entry: `organizer_added_participant_to_session`

**Capacity note:** A manual organiser add honours the capacity limit.
If the session is at capacity, the add is rejected with a descriptive error.

### Remove Participant from Session

**Endpoint:** `DELETE /api/v1/workshops/{workshop}/sessions/{session}/participants/{user}`

**Behaviour:**
- Cancels the `session_selections` row (`selection_status = 'canceled'`)
- Does **not** delete the `attendance_records` row; status remains as-is for
  historical accuracy
- Does **not** cancel the participant's workshop registration
- Writes `audit_logs` entry: `organizer_removed_participant_from_session`

---

## Roster Access

| Role | Roster Access |
|---|---|
| Participant | None — participants cannot view any roster |
| Leader (assigned session, status = accepted) | Roster for their assigned session only |
| Leader (unassigned, or assignment_status ≠ accepted) | No access |
| `staff` | All sessions in the organisation |
| `admin` | All sessions in the organisation |
| `owner` | All sessions in the organisation |
| `billing_admin` | None |

`BuildSessionRosterService` enforces this scope at query time.
`RosterPolicy` enforces it at the authorization layer.
Both layers are required.

---

## Phone Number Visibility in Roster Context

Participant phone numbers (`users.phone_number`) visible in roster context:

**Visible to:**
- Leaders with an accepted `session_leaders` assignment for the session
- Organisation members with `owner`, `admin`, or `staff` roles

**Never visible to:**
- Participants viewing their own check-in status
- Leaders without an accepted session assignment
- `billing_admin` role
- Public endpoints

`RosterParticipantResource` applies this conditionally based on the requesting
user's role and session assignment.

---

## Status Transitions

Valid transitions for `attendance_records.status`:
not_checked_in  →  checked_in    (self or leader)
not_checked_in  →  no_show       (leader only)
checked_in      →  no_show       (leader override)
no_show         →  checked_in    (leader override)

The reverse transition from `checked_in` or `no_show` back to `not_checked_in`
is not a standard transition. If needed for data correction, it must be an
organiser-level action.

---

## Organiser Attendance Summary

Organisation members with `owner`, `admin`, or `staff` roles can view an aggregate
attendance summary across all sessions of a workshop.

`BuildWorkshopAttendanceSummaryService` assembles per-session counts:
- total enrolled
- checked_in count
- no_show count
- not_checked_in count

---

## UI Requirements

### Leader View
- Participant list for assigned session
- Check-in status badge per participant
- Quick actions: Mark Checked In, Mark No-Show
- Phone numbers visible (leader has accepted assignment)

### Participant View
- Check-in button (active when check-in is eligible)
- Confirmation state after check-in

### Organiser View
- Full session roster with all participants
- Attendance status per participant
- Add/Remove participant actions
- Attendance summary totals

---

## Audit Requirements

Log to `audit_logs`:
- participant self check-in
- leader manual check-in
- attendance status override (leader or organiser)
- no-show marking
- organiser add participant to session
- organiser remove participant from session