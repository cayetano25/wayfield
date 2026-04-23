# Wayfield – Add-On Sessions and Session Access Control (v1)

> **Source Authority:** `MASTER_PROMPT.md`, `DATA_SCHEMA_FULL.md` (Table 18, 21), `SESSION_AND_CAPACITY_MODEL.md`, `PERMISSIONS_AND_PRIVACY_MODEL.md`
> This document extends the session model. The canonical schema file overrides field names on conflict.
> Read alongside: `PHASED_IMPLEMENTATION_PLAN.md`, `TESTING_AND_VALIDATION_STRATEGY.md`

---

## 1. Overview

### 1.1 The Problem with the Current Model

The current session model uses a single `is_published` boolean to control whether a session is operationally active. This conflates three independent concerns:

- **Operational status** — Is this session running? Should leaders and attendance systems treat it as live?
- **Participant visibility** — Should this session appear in the self-selection UI?
- **Enrollment mode** — Can a participant add themselves, or must an organizer assign them?

This conflation creates a gap: there is currently no clean way to create a session that is fully operational (published, tracked, roster-enabled) but should NOT be self-selectable by participants. The only workarounds — keeping a session draft, or relying on frontend hiding — are both incorrect. A draft session is not operationally active. Frontend-only hiding is not a security control.

This gap affects the following real use cases:

- **Add-on sessions** — Private workshops, portfolio reviews, mentorship slots, or ancillary sessions that should appear in assigned participants' schedules but must not be discoverable or self-selectable.
- **Organizer-controlled enrollment** — Sessions where capacity is limited and allocation is intentional (VIP access, upgrade tracks, makeup sessions).
- **Hidden operational sessions** — Staff briefings, leader prep sessions, or administrative schedule blocks that must be tracked in the system without appearing to participants.
- **Future paid add-ons** — Sessions that will eventually require purchase or entitlement to access, requiring a stable enrollment mode distinction before monetization is layered in.

### 1.2 The Solution: Three Independent Controls

This document defines three independent controls that must be stored and enforced separately:

| Control | Purpose | Field |
|---|---|---|
| Publication Status | Operational readiness | `publication_status` (replaces `is_published`) |
| Participant Visibility | Whether the session appears in selection UI | `participant_visibility` |
| Enrollment Mode | How a participant gets into the session | `enrollment_mode` |

These three controls must NEVER be inferred from each other. A session with `participant_visibility = hidden` may still be fully published and operationally active. A session with `enrollment_mode = organizer_assign_only` may still be visible to participants in their "My Schedule" view once assigned.

### 1.3 Add-On Sessions Defined

An **add-on session** is a session that is:

- Published (operationally active)
- Hidden from the participant self-selection UI
- Populated exclusively via organizer assignment

Add-on sessions appear in a participant's personal schedule only if they have been explicitly assigned by an organizer. Leaders assigned to add-on sessions operate them identically to standard sessions — they see the roster, manage attendance, and interact with their assigned participants.

---

## 2. Goals

- Support organizer-assigned sessions that are invisible in participant self-selection but fully operational.
- Prevent participant self-selection for sessions where enrollment must be organizer-controlled.
- Allow assigned participants to see add-on sessions in their personal schedule.
- Preserve all existing leader workflows: roster access, attendance management, and constrained messaging remain unchanged.
- Track the source of every participant-session relationship for auditability.
- Lay stable groundwork for future paid add-ons, invite-only access, and entitlement-based session gating without requiring schema migration.
- Enforce all rules in backend business logic. Frontend controls are supplementary only.
- Emit audit log entries for all participant assignment actions.
- Default all existing sessions to backward-compatible values with no behavioral change.

---

## 3. Non-Goals

The following are explicitly out of scope for this document and this implementation phase:

- **Payment processing** — Sessions with `enrollment_mode = purchase_required` are modeled but not implemented. No payment integration, pricing fields, or checkout flows are introduced here.
- **Complex invite workflows** — The `invite_accept` enrollment mode and `invite_only` visibility value are modeled for future use. The invite token flow, invite email, and acceptance screen for session-level invites are not built in this phase.
- **Waitlists for add-on sessions** — The `waitlist_promoted` assignment source is modeled but waitlist queue logic for add-on sessions is not implemented.
- **Discovery or public session listings** — Public-facing session browsing or searchability is unaffected by this change and remains out of scope.
- **Entitlement or plan gating of individual sessions** — The `requires_separate_entitlement` boolean is scaffolded but the entitlement resolution path for session-level gating is not wired in this phase.
- **Bulk assignment tools** — CSV import or batch assignment of participants to add-on sessions is a future enhancement.

---

## 4. Core Concepts

### 4.1 Session Type

`session_type` describes the intended role of a session within a workshop. It is a semantic classification used to drive organizer UI, filtering, and future feature logic. It does NOT directly enforce access rules — those are controlled by `participant_visibility` and `enrollment_mode`.

| Value | Description |
|---|---|
| `standard` | A normal selectable session within a workshop track. Default for all existing and new sessions unless specified otherwise. |
| `addon` | A supplementary session that extends or enriches the workshop for a subset of participants. Typically hidden and organizer-assigned. |
| `private` | Reserved for future use. Intended for sessions visible only to specific groups via invite or entitlement. Not active in this phase. |
| `vip` | Reserved for future use. Intended for premium sessions tied to plan or purchase entitlement. Not active in this phase. |
| `makeup_session` | Reserved for future use. Intended for rescheduled or remedial sessions assigned to participants who missed an earlier session. Not active in this phase. |

**Defaults:**
- New sessions created via API default to `session_type = standard`.
- All existing sessions must be migrated to `session_type = standard`.

**Constraint:** `session_type` is informational and filtering-oriented. Backend enforcement of enrollment and visibility rules must never rely solely on `session_type`. The `participant_visibility` and `enrollment_mode` fields are the authoritative enforcement controls.

---

### 4.2 Publication Status

`publication_status` replaces the existing `is_published` boolean and extends it to cover the full operational lifecycle of a session.

| Value | Description |
|---|---|
| `draft` | Session is not visible to participants. Not operationally active. Fully editable by organizers. |
| `published` | Session is operationally active. Visible to eligible participants per `participant_visibility`. Attendance tracking is live. |
| `archived` | Session is read-only and closed. Visible in historical views. No new check-ins or selections allowed. |
| `cancelled` | Session has been cancelled. Assigned participants should be notified. Historical record retained. |

**Migration from `is_published`:**

| `is_published` | Migrated `publication_status` |
|---|---|
| `false` | `draft` |
| `true` | `published` |

**Constraints:**
- Organizers may transition: `draft` → `published`, `published` → `archived`, `published` → `cancelled`.
- A session cannot transition from `archived` or `cancelled` back to `published` without explicit admin action.
- The existing publish validation rules remain in effect: virtual/hybrid sessions require `meeting_url` before `publication_status` can be set to `published`.

---

### 4.3 Participant Visibility

`participant_visibility` controls whether a session appears in the participant-facing session selection interface.

| Value | Description |
|---|---|
| `visible` | Session appears in participant self-selection UI (subject to publication status, capacity, and enrollment mode). |
| `hidden` | Session does NOT appear in participant self-selection UI. Participants assigned by an organizer will see it in "My Schedule" only. |
| `invite_only` | Reserved for future use. Session will be visible only to participants who have received and accepted a session-level invite. Not active in this phase. |

**Important:** `participant_visibility = hidden` does NOT prevent a session from being operationally active. Leaders can still be assigned, attendance can still be tracked, and the session appears in the organizer's session management views.

**Defaults:**
- New sessions default to `participant_visibility = visible`.
- Add-on sessions should be set to `participant_visibility = hidden` (this is a recommended pattern, not a system-enforced constraint — the organizer controls this).
- All existing sessions must be migrated to `participant_visibility = visible`.

---

### 4.4 Enrollment Mode

`enrollment_mode` defines how a participant becomes associated with a session.

| Value | Description |
|---|---|
| `self_select` | Participants may select this session themselves, subject to `participant_visibility`, capacity, and conflict rules. |
| `organizer_assign_only` | Only an organizer may add participants to this session. Participant self-selection is blocked at the backend regardless of visibility. |
| `invite_accept` | Reserved for future use. A participant may only join via accepting a session-level invite. Not active in this phase. |
| `purchase_required` | Reserved for future use. Enrollment requires a completed purchase or entitlement. Not active in this phase. |

**Interaction Model — The Three Controls Together:**

The three controls are AND-gated for self-selection. A participant may self-select a session only if ALL of the following are true:

1. `publication_status = published`
2. `participant_visibility = visible`
3. `enrollment_mode = self_select`

If any one of these conditions is false, self-selection is blocked at the backend. UI controls should hide the selection button as a supplement, but backend enforcement is the authoritative gate.

Organizer assignment bypasses `participant_visibility` and `enrollment_mode` checks. An organizer may assign a participant to any published session regardless of its visibility or enrollment mode. The organizer cannot bypass capacity limits unless an explicit override is provided (see Section 6.2).

**Defaults for standard sessions:**
- `enrollment_mode = self_select`

**Defaults for add-on sessions:**
- `enrollment_mode = organizer_assign_only`

---

## 5. Data Model Changes

### 5.1 Sessions Table Changes

The following fields are added to the `sessions` table (extending `DATA_SCHEMA_FULL.md` Table 18).

```sql
ALTER TABLE sessions
  ADD COLUMN session_type ENUM(
    'standard',
    'addon',
    'private',
    'vip',
    'makeup_session'
  ) NOT NULL DEFAULT 'standard' AFTER workshop_id,

  ADD COLUMN publication_status ENUM(
    'draft',
    'published',
    'archived',
    'cancelled'
  ) NOT NULL DEFAULT 'draft' AFTER is_published,

  ADD COLUMN participant_visibility ENUM(
    'visible',
    'hidden',
    'invite_only'
  ) NOT NULL DEFAULT 'visible' AFTER publication_status,

  ADD COLUMN enrollment_mode ENUM(
    'self_select',
    'organizer_assign_only',
    'invite_accept',
    'purchase_required'
  ) NOT NULL DEFAULT 'self_select' AFTER participant_visibility,

  ADD COLUMN requires_separate_entitlement BOOLEAN NOT NULL DEFAULT FALSE
    AFTER enrollment_mode,

  ADD COLUMN selection_opens_at DATETIME NULL AFTER requires_separate_entitlement,
  ADD COLUMN selection_closes_at DATETIME NULL AFTER selection_opens_at;
```

**Field Definitions:**

| Field | Type | Default | Description |
|---|---|---|---|
| `session_type` | ENUM | `standard` | Semantic classification. See Section 4.1. |
| `publication_status` | ENUM | `draft` | Replaces `is_published`. See Section 4.2. |
| `participant_visibility` | ENUM | `visible` | Controls selection UI appearance. See Section 4.3. |
| `enrollment_mode` | ENUM | `self_select` | Controls how participants join. See Section 4.4. |
| `requires_separate_entitlement` | BOOLEAN | `false` | Scaffold for future plan-gated session access. Not enforced in this phase. |
| `selection_opens_at` | DATETIME NULL | NULL | If set, self-selection is blocked before this timestamp. Future feature — not enforced in Phase 1 of this feature. |
| `selection_closes_at` | DATETIME NULL | NULL | If set, self-selection is blocked after this timestamp. Future feature — not enforced in Phase 1 of this feature. |

**Deprecation of `is_published`:**

`is_published` must be retained during a transition period and kept in sync with `publication_status` via a database trigger or application-layer dual-write. Once all consumers have been migrated to read `publication_status`, `is_published` may be dropped in a subsequent migration. The synchronization rule is:

- `publication_status = published` ↔ `is_published = true`
- All other `publication_status` values ↔ `is_published = false`

**Indexes to Add:**

```sql
ALTER TABLE sessions
  ADD INDEX idx_sessions_session_type (session_type),
  ADD INDEX idx_sessions_publication_status (publication_status),
  ADD INDEX idx_sessions_participant_visibility (participant_visibility),
  ADD INDEX idx_sessions_enrollment_mode (enrollment_mode);
```

---

### 5.2 Participant Session Relationship Updates

The `session_selections` table (DATA_SCHEMA_FULL.md Table 21) tracks the participant-to-session relationship. This table must be extended to record how a participant came to be in a session.

**Current schema:**

```
session_selections
  id
  registration_id (FK → registrations)
  session_id (FK → sessions)
  selection_status (enum: selected, canceled, waitlisted)
  created_at
  updated_at
```

**New fields:**

```sql
ALTER TABLE session_selections
  ADD COLUMN assignment_source ENUM(
    'self_selected',
    'organizer_assigned',
    'invite_accepted',
    'waitlist_promoted',
    'addon_purchase'
  ) NOT NULL DEFAULT 'self_selected' AFTER selection_status,

  ADD COLUMN assigned_by_user_id BIGINT UNSIGNED NULL
    REFERENCES users(id) ON DELETE SET NULL
    AFTER assignment_source,

  ADD COLUMN assigned_at DATETIME NULL AFTER assigned_by_user_id,

  ADD COLUMN assignment_notes TEXT NULL AFTER assigned_at;
```

**Index to Add:**

```sql
ALTER TABLE session_selections
  ADD INDEX idx_session_selections_assignment_source (assignment_source),
  ADD INDEX idx_session_selections_assigned_by (assigned_by_user_id);
```

**Field Definitions:**

| Field | Type | Nullable | Description |
|---|---|---|---|
| `assignment_source` | ENUM | No | How the participant entered this session. |
| `assigned_by_user_id` | BIGINT UNSIGNED | Yes | The `users.id` of the organizer who performed the assignment. NULL for self-selected rows. |
| `assigned_at` | DATETIME | Yes | Timestamp of assignment action. NULL for self-selected (use `created_at` instead). |
| `assignment_notes` | TEXT | Yes | Optional organizer note at time of assignment (e.g., "Assigned for portfolio review"). |

**`assignment_source` Values:**

| Value | Description |
|---|---|
| `self_selected` | Participant selected the session themselves via the selection UI. `assigned_by_user_id` is NULL. |
| `organizer_assigned` | An organizer added the participant directly. `assigned_by_user_id` holds the organizer's `users.id`. |
| `invite_accepted` | Future. Participant accepted a session-level invite. |
| `waitlist_promoted` | Future. Participant was promoted from a waitlist. |
| `addon_purchase` | Future. Participant gained access through a purchase or entitlement unlock. |

**Audit Importance:**

Every row in `session_selections` now carries a traceable chain of custody. Organizers assigning participants to add-on sessions, or overriding selections, are fully identified. This is required both for operational trust (leaders can see who was assigned and by whom, if surfaced) and for compliance with the platform's audit logging requirements. All assignment actions must also emit a record to `audit_logs` — see Section 13.

---

## 6. Business Rules

### 6.1 Self-Selection Rules

A participant-initiated session selection is valid only when all of the following conditions are met, enforced in the backend selection service (`SelectSessionAction`):

1. The participant has an active `registration` for the parent workshop (`registration_status = registered`).
2. The session's `publication_status = published`.
3. The session's `participant_visibility = visible`.
4. The session's `enrollment_mode = self_select`.
5. No existing `session_selections` row exists for this `(registration_id, session_id)` pair with `selection_status = selected`.
6. The session has not reached capacity (if `capacity IS NOT NULL`, the count of rows in `session_selections` where `session_id = ?` and `selection_status = selected` must be less than `sessions.capacity`). Capacity check must use `SELECT ... FOR UPDATE` or equivalent locking.
7. No schedule conflict exists — the participant does not have another selected session whose `start_at`/`end_at` range overlaps with this session.
8. If `selection_opens_at IS NOT NULL`, the current UTC time must be ≥ `selection_opens_at`.
9. If `selection_closes_at IS NOT NULL`, the current UTC time must be ≤ `selection_closes_at`.

If any condition is false, the selection must be rejected with a specific, actionable error response. The error must identify which rule failed (e.g., `SESSION_NOT_SELF_SELECTABLE`, `SESSION_AT_CAPACITY`, `SCHEDULE_CONFLICT`).

**On success**, the `session_selections` row is created with:
- `selection_status = selected`
- `assignment_source = self_selected`
- `assigned_by_user_id = NULL`
- `assigned_at = NULL`

---

### 6.2 Organizer Assignment Rules

An organizer (`organization_users.role IN ('owner', 'admin')` for the workshop's organization) may assign a participant to a session under the following rules:

1. The target participant must have an active `registration` for the parent workshop (`registration_status = registered`).
2. The session must belong to the same workshop as the participant's registration.
3. The session's `publication_status` must be `published`. Organizers cannot assign participants to draft, archived, or cancelled sessions.
4. The session's `enrollment_mode` may be either `organizer_assign_only` OR `self_select`. Organizers may assign to any non-draft published session.
5. Capacity is enforced by default. If the session is at capacity, the assignment must be rejected unless the organizer explicitly passes a force override flag (`force_assign: true`) in the request. Override capability should be gated on `role IN ('owner', 'admin')` only.
6. Schedule conflicts for the participant are checked and surfaced as a warning but do NOT block organizer assignment. The organizer receives a conflict warning in the response and must acknowledge it. This is an intentional design choice: organizers may have legitimate reasons to assign participants to overlapping sessions (e.g., one is a passive session, or the conflict is minor).
7. An existing canceled or waitlisted `session_selections` row for this pair may be updated to `selection_status = selected` rather than creating a duplicate. A new row should only be inserted if no existing row exists.

**On success**, the `session_selections` row is created or updated with:
- `selection_status = selected`
- `assignment_source = organizer_assigned`
- `assigned_by_user_id = <organizer's users.id>`
- `assigned_at = <current UTC timestamp>`
- `assignment_notes = <value from request, if provided>`

An `audit_logs` entry must be written — see Section 13.

**`staff` role assignment:**

Organization members with `role = staff` may NOT assign participants to add-on sessions with `enrollment_mode = organizer_assign_only`. Staff may manage attendance for existing session assignments but may not create new assignments to organizer-only sessions. Staff MAY assign participants to `enrollment_mode = self_select` sessions (e.g., swapping a participant's selection with organizer assistance).

---

### 6.3 Visibility Rules

**In the participant session selection interface:**

- Only sessions satisfying ALL of the following must be returned:
  - `publication_status = published`
  - `participant_visibility = visible`
  - `enrollment_mode = self_select`

Sessions that fail any of these conditions must be excluded from the selection UI response. This is enforced in the API serializer/query layer — the backend must not return hidden or non-self-selectable sessions in the selection listing endpoint.

**In participant "My Schedule":**

- All sessions where the participant has an active `session_selections` row (`selection_status = selected`) must be returned, regardless of `participant_visibility` or `enrollment_mode`.
- A participant who has been organizer-assigned to a hidden session must see that session in their schedule with all standard schedule fields (time, location, leader names, delivery type, meeting link for virtual/hybrid).

**In organizer session management:**

- All sessions for the workshop must be returned regardless of visibility or enrollment mode.
- Sessions should be clearly labelled with their `session_type`, `participant_visibility`, and `enrollment_mode` values.

**In public workshop pages:**

- Only sessions with `publication_status = published` AND `participant_visibility = visible` may be shown on the public workshop page.
- Hidden sessions must NEVER appear in any public endpoint.

**`invite_only` visibility (future):**

When `participant_visibility = invite_only` is activated, the session will not appear in the general selection UI but will be visible to participants who have a valid session-level invite. This enforcement path is reserved; no invite-lookup logic is implemented in this phase.

---

### 6.4 Leader Access Rules

Leader access to sessions is governed by `session_leaders` assignment (DATA_SCHEMA_FULL.md Table 19), not by `participant_visibility` or `enrollment_mode`. These three controls have no effect on leader access.

- A leader assigned to an add-on session (`session_type = addon`, `participant_visibility = hidden`, `enrollment_mode = organizer_assign_only`) has identical operational access to that session as they would for any standard session.
- The roster returned to the leader includes ALL participants with `session_selections.selection_status = selected` for that session, regardless of `assignment_source`. A leader sees self-selected and organizer-assigned participants in the same roster view.
- Attendance tracking (self-check-in, leader check-in, no-show marking) is unchanged.
- Phone number visibility rules are unchanged: assigned leaders see participant phone numbers for their assigned sessions only.

**Leader messaging constraints remain fully in effect for add-on sessions.** The time-window rule (4 hours before `start_at` through 2 hours after `end_at`, computed in workshop timezone) and the session-participant scope restriction apply to add-on sessions exactly as they do to standard sessions.

---

## 7. Organizer Workflows

### 7.1 Creating an Add-On Session

Creating an add-on session follows the standard session creation workflow with the following field values set:

**Step-by-step:**

1. Navigate to Workshop → Sessions → New Session.
2. Complete all required session fields: title, `start_at`, `end_at`, `delivery_type`, and `location_id` or workshop default.
3. Set **Session Type** to `addon`.
4. Set **Participant Visibility** to `hidden` (recommended default for add-ons; system should pre-select this when `session_type = addon` is chosen, but the organizer may override).
5. Set **Enrollment Mode** to `organizer_assign_only` (recommended default for add-ons; system should pre-select this when `session_type = addon` is chosen, but the organizer may override).
6. Optionally set capacity if the add-on has a seat limit.
7. Save as draft. Assign leaders. Publish when ready.

**API — session create:**

```json
POST /api/v1/workshops/{workshop}/sessions

{
  "title": "Portfolio Review – Group A",
  "start_at": "2025-09-15T14:00:00Z",
  "end_at": "2025-09-15T15:30:00Z",
  "delivery_type": "in_person",
  "location_id": 12,
  "capacity": 8,
  "session_type": "addon",
  "participant_visibility": "hidden",
  "enrollment_mode": "organizer_assign_only"
}
```

---

### 7.2 Assigning Participants to an Add-On Session

After a session is published, the organizer assigns participants using a dedicated assignment endpoint.

**Workflow:**

1. Open the add-on session in the organizer interface.
2. Navigate to the **Assigned Participants** panel.
3. Search participants registered for the workshop.
4. Select one or more participants and confirm assignment.
5. Optionally enter assignment notes (e.g., "Selected for advanced review track").
6. Optionally trigger a notification to the participant informing them of the new session in their schedule.
7. The system enforces capacity. If at capacity, the organizer is informed and must either increase capacity or use the force override (owner/admin only).

**API — participant assignment:**

```json
POST /api/v1/sessions/{session}/participants

{
  "user_id": 489,
  "assignment_notes": "Selected for portfolio review group A",
  "force_assign": false,
  "notify_participant": true
}
```

**Response when session is at capacity and `force_assign = false`:**

```json
{
  "error": "SESSION_AT_CAPACITY",
  "message": "This session has reached its capacity of 8 participants. Use force_assign to override.",
  "current_count": 8,
  "capacity": 8
}
```

**Response when a schedule conflict exists (conflict is a warning, not a block):**

```json
{
  "data": { ...assignment row... },
  "warnings": [
    {
      "code": "SCHEDULE_CONFLICT",
      "message": "Participant already has a selection for 'Editing Fundamentals' (14:00–15:30 on Sep 15). This assignment was created anyway."
    }
  ]
}
```

---

### 7.3 Managing Add-On Session Capacity

- The session detail view in the organizer UI must display the assigned count vs. capacity (e.g., "6 / 8 assigned").
- Organizers may increase capacity at any time.
- Reducing capacity below the current assigned count must be blocked with an error unless the organizer explicitly removes participants first.
- If `capacity IS NULL`, the add-on session is unlimited.

---

### 7.4 Removing a Participant from an Add-On Session

```json
DELETE /api/v1/sessions/{session}/participants/{user}

Optional body:
{
  "reason": "Participant rescheduled to Group B",
  "notify_participant": true
}
```

The `session_selections` row must be updated to `selection_status = canceled`. It must not be deleted — the row is an audit record. An `audit_logs` entry must be written.

---

## 8. Participant Experience

### 8.1 Session Selection Screen

The session selection screen must query sessions using the full three-control filter:

- `publication_status = published`
- `participant_visibility = visible`
- `enrollment_mode = self_select`

Sessions failing any of these conditions must be completely absent from the response. The frontend must never rely on its own filtering to hide sessions from this list. Add-on sessions with `participant_visibility = hidden` must never appear in this view.

Capacity display for visible self-select sessions:
- Display available slot count if capacity is set (e.g., "4 spots remaining").
- Display "Full" if at capacity.

---

### 8.2 My Schedule

The "My Schedule" view queries the participant's `session_selections` where `selection_status = selected`, joining to the sessions table. There is no filter on `participant_visibility` or `enrollment_mode` in this query — a participant who has been assigned to a hidden add-on session MUST see it in their schedule.

**Recommended display treatment for add-on sessions in My Schedule:**

- Show with all standard session fields: title, time, location, leader names, delivery type, join meeting link (if virtual/hybrid).
- An optional badge or label (e.g., "Add-On") may be applied to sessions where `session_type = addon`, but this is a UX enhancement and is not required.
- Do NOT expose `participant_visibility`, `enrollment_mode`, or `session_type` values directly to participants in the UI.

---

### 8.3 Participant Notifications on Assignment

When a participant is assigned to an add-on session, the organizer may choose to send a notification (`notify_participant: true`). The notification:

- Is of type `informational`.
- Is scoped as `session_participants` delivery.
- Informs the participant that a new session has been added to their schedule.
- Is queued through the standard notification delivery pipeline.
- Is subject to the participant's notification preferences.

This notification is sent by the organizing system, not by the leader. Leader messaging constraints do not apply here.

---

## 9. Leader Experience

Leaders interacting with add-on sessions have an operationally identical experience to standard sessions. No changes to leader-facing UI or workflows are required beyond ensuring the session appears in their session list.

**Roster:**
- The roster for an add-on session is built from all `session_selections` rows where `session_id = ?` and `selection_status = selected`.
- `assignment_source` may be surfaced to leaders as an informational field (e.g., "Organizer assigned") if the organizer UI design requires it, but this is optional and should not change leader behavior.
- Phone number visibility rules are unchanged.

**Attendance:**
- Self-check-in, leader check-in, and no-show marking work identically for add-on sessions.
- The `attendance_records` table is unchanged — a row per `(session_id, user_id)`.

**Messaging:**
- Leader messaging time-window and session-participant scope constraints apply to add-on sessions without exception. A leader assigned to an add-on session may message only the participants in that session, and only within the 4-hour-before / 2-hour-after window.

**Session listing for leaders:**
- Leaders see all sessions they are assigned to via `session_leaders`. The `participant_visibility` of a session does not affect whether a leader can see or access their assigned sessions.

---

## 10. UI/UX Recommendations

### 10.1 Organizer Session Creation and Edit UI

Add the following controls to the session create/edit form:

**Session Type** (dropdown)
- Standard Session
- Add-On Session
- _(Private — coming soon, disabled)_
- _(VIP — coming soon, disabled)_
- _(Makeup Session — coming soon, disabled)_

**Participant Visibility** (toggle or select)
- `visible` → label: "Visible in session selection"
- `hidden` → label: "Hidden from session selection"

**Enrollment Mode** (toggle or select)
- `self_select` → label: "Participants can select this session"
- `organizer_assign_only` → label: "Organizer assignment only"

**Recommended auto-population on session type change:**

When the organizer selects "Add-On Session", the UI should automatically set:
- Participant Visibility → "Hidden from session selection"
- Enrollment Mode → "Organizer assignment only"

This is a UI convenience only. The organizer may override these values. The backend must not reject any valid combination.

**Inline helper text:**

| Control | Helper Text |
|---|---|
| Hidden from session selection | "This session will not appear in the participant schedule selection screen. Participants will only see it in My Schedule after being assigned." |
| Organizer assignment only | "Participants cannot add themselves to this session. Only organizers can assign participants." |

---

### 10.2 Session List Filtering

The organizer session list must support the following filter chips or dropdown filters:

| Filter Label | Backend Filter |
|---|---|
| Standard | `session_type = standard` |
| Add-On | `session_type = addon` |
| Hidden | `participant_visibility = hidden` |
| Self-Select | `enrollment_mode = self_select` |
| Assigned-Only | `enrollment_mode = organizer_assign_only` |
| Draft | `publication_status = draft` |
| Published | `publication_status = published` |
| Archived | `publication_status = archived` |
| Cancelled | `publication_status = cancelled` |

Filters should be combinable. The default view shows all sessions regardless of type or visibility.

---

### 10.3 Add-On Session Participant Assignment Panel

When an organizer opens a session with `enrollment_mode = organizer_assign_only`, a dedicated "Assigned Participants" panel must be visible (this panel may also be accessible for self-select sessions as an organizer management tool).

Panel elements:
- Participant search bar (searches by name or email within the workshop's registered participants).
- Assigned participant list with check-in status, assignment source label, and assignment timestamp.
- Capacity indicator: "X of Y assigned" (if capacity is set).
- Remove participant action per row.
- Assignment notes field on assignment action.
- Optional notification toggle: "Notify participant of assignment".

---

## 11. API Changes

### 11.1 Updated Session Fields in All Session Payloads

All session-related API responses must include the new fields. Serializer context rules apply:

| Field | Organizer Serializer | Leader Serializer | Participant Serializer | Public Serializer |
|---|---|---|---|---|
| `session_type` | ✅ Full value | ✅ Full value | ❌ Omit | ❌ Omit |
| `publication_status` | ✅ Full value | ✅ Full value | ❌ Omit | ❌ Omit |
| `participant_visibility` | ✅ Full value | ❌ Omit | ❌ Omit | ❌ Omit |
| `enrollment_mode` | ✅ Full value | ❌ Omit | ❌ Omit | ❌ Omit |
| `requires_separate_entitlement` | ✅ Full value | ❌ Omit | ❌ Omit | ❌ Omit |
| `selection_opens_at` | ✅ Full value | ❌ Omit | ❌ Omit | ❌ Omit |
| `selection_closes_at` | ✅ Full value | ❌ Omit | ❌ Omit | ❌ Omit |
| `assignment_source` | ✅ (on selection rows) | ✅ (on roster rows) | ❌ Omit | ❌ Omit |

---

### 11.2 New and Updated Endpoints

**Participant Self-Selection Listing (updated):**

```
GET /api/v1/workshops/{workshop}/selection-options
```

Backend query must filter:
```sql
WHERE publication_status = 'published'
  AND participant_visibility = 'visible'
  AND enrollment_mode = 'self_select'
```

**Session Create/Update (updated):**

```
POST /api/v1/workshops/{workshop}/sessions
PATCH /api/v1/sessions/{session}
```

New accepted fields:
- `session_type`
- `participant_visibility`
- `enrollment_mode`
- `requires_separate_entitlement`
- `selection_opens_at`
- `selection_closes_at`

**Participant Assignment (new):**

```
POST /api/v1/sessions/{session}/participants
```

Auth: Bearer token — `organization_users.role IN ('owner', 'admin')` for the session's parent organization.

Request body:
```json
{
  "user_id": 489,
  "assignment_notes": "string|nullable|max:500",
  "force_assign": "boolean|default:false",
  "notify_participant": "boolean|default:false"
}
```

Response: `201 Created` with the `session_selections` row payload on success.

**Participant Removal (new):**

```
DELETE /api/v1/sessions/{session}/participants/{user}
```

Auth: Bearer token — `organization_users.role IN ('owner', 'admin')`.

Optional request body:
```json
{
  "reason": "string|nullable|max:500",
  "notify_participant": "boolean|default:false"
}
```

**Organizer Assigned Participants List (new):**

```
GET /api/v1/sessions/{session}/participants
```

Auth: Organizer or assigned leader.

Returns all `session_selections` rows with `selection_status = selected` for the session, joined to participant user data. Includes `assignment_source`, `assigned_by_user_id`, `assigned_at`, `assignment_notes`. Phone number visibility rules apply (see `PERMISSIONS_AND_PRIVACY_MODEL.md`).

---

### 11.3 Validation Rules at API Layer

The following invalid combinations must be rejected with a `422 Unprocessable Entity` response and a descriptive error:

| Invalid Combination | Error Code |
|---|---|
| `publication_status = published` AND `delivery_type IN ('virtual', 'hybrid')` AND `meeting_url IS NULL` | `VIRTUAL_SESSION_MISSING_MEETING_URL` |
| `enrollment_mode = organizer_assign_only` AND `participant_visibility = visible` | `WARN_VISIBILITY_ENROLLMENT_MISMATCH` (Warning only — allowed but flagged; organizer must confirm intent) |
| `session_type = addon` AND `participant_visibility = visible` AND `enrollment_mode = self_select` | `WARN_ADDON_FULLY_PUBLIC` (Warning only — technically valid, organizer must confirm intent) |
| `requires_separate_entitlement = true` AND no entitlement system active | Accepted but logged; no enforcement in this phase |

Note: Warnings should return `200 OK` or `201 Created` with a `warnings` array in the response body rather than blocking the operation. Organizers may choose to proceed despite the inconsistency.

---

## 12. Validation Rules Summary

### Session Field Validation on Create/Update

| Field | Rules |
|---|---|
| `session_type` | Must be a valid enum value. Defaults to `standard`. `private`, `vip`, `makeup_session` are accepted and stored but have no active enforcement in this phase. |
| `publication_status` | Must be a valid enum value. Transition rules enforced (see Section 4.2). Cannot set to `published` if virtual/hybrid without `meeting_url`. |
| `participant_visibility` | Must be a valid enum value. `invite_only` is accepted but has no enforcement in this phase. |
| `enrollment_mode` | Must be a valid enum value. `invite_accept` and `purchase_required` are accepted but have no active enforcement in this phase. |
| `requires_separate_entitlement` | Boolean. Defaults to `false`. |
| `selection_opens_at` | If set, must be a valid datetime. Must be before `selection_closes_at` if both are set. No enforcement in this phase. |
| `selection_closes_at` | If set, must be a valid datetime. Must be after `selection_opens_at` if both are set. No enforcement in this phase. |

### Self-Selection Validation

All seven conditions in Section 6.1 must be enforced. The backend must not perform partial enforcement.

### Organizer Assignment Validation

All six conditions in Section 6.2 must be enforced. Force override must be explicitly supplied and is role-gated.

---

## 13. Audit Logging

All audit log entries are written to the `audit_logs` table (DATA_SCHEMA_FULL.md Table 32) via the central `AuditLogService::record()` method as defined in `LARAVEL_IMPLEMENTATION_PLAN.md`.

**New audit events introduced by this feature:**

| Event | `entity_type` | `action` | `metadata_json` Contents |
|---|---|---|---|
| Participant assigned to session | `session_selection` | `organizer_assigned` | `session_id`, `user_id`, `assigned_by_user_id`, `assignment_source`, `assignment_notes`, `force_assign_used` |
| Participant removed from session | `session_selection` | `organizer_removed` | `session_id`, `user_id`, `removed_by_user_id`, `reason`, `previous_selection_status` |
| Session type changed | `session` | `session_type_updated` | `session_id`, `old_session_type`, `new_session_type`, `changed_by_user_id` |
| Session visibility changed | `session` | `session_visibility_updated` | `session_id`, `old_participant_visibility`, `new_participant_visibility`, `changed_by_user_id` |
| Session enrollment mode changed | `session` | `session_enrollment_mode_updated` | `session_id`, `old_enrollment_mode`, `new_enrollment_mode`, `changed_by_user_id` |
| Capacity override used | `session` | `assignment_capacity_override` | `session_id`, `user_id`, `capacity`, `count_at_time_of_override`, `overriding_user_id` |

**Existing audit events that remain applicable:**

- Self-check-in, leader check-in, no-show marking — unchanged, as defined in `ATTENDANCE_AND_ROSTER_SYSTEM.md`.
- Leader messaging — unchanged, as defined in `NOTIFICATIONS_AND_MESSAGING_SYSTEM.md`.

---

## 14. Migration Strategy

### 14.1 Database Migration

Migrations must be applied in a single atomic operation or in a two-step safe migration approach to avoid downtime.

**Step 1 — Add new nullable columns with safe defaults:**

Add all new columns to `sessions` as nullable first, with no enforcement, to allow the migration to run without locking the table on large datasets. Then backfill, then add constraints.

```sql
-- Step 1a: Add columns as nullable
ALTER TABLE sessions
  ADD COLUMN session_type VARCHAR(50) NULL,
  ADD COLUMN publication_status VARCHAR(50) NULL,
  ADD COLUMN participant_visibility VARCHAR(50) NULL,
  ADD COLUMN enrollment_mode VARCHAR(50) NULL,
  ADD COLUMN requires_separate_entitlement TINYINT(1) NULL,
  ADD COLUMN selection_opens_at DATETIME NULL,
  ADD COLUMN selection_closes_at DATETIME NULL;

-- Step 1b: Backfill existing rows
UPDATE sessions SET
  session_type = 'standard',
  publication_status = CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END,
  participant_visibility = 'visible',
  enrollment_mode = 'self_select',
  requires_separate_entitlement = 0
WHERE session_type IS NULL;

-- Step 1c: Alter columns to NOT NULL with defaults
ALTER TABLE sessions
  MODIFY COLUMN session_type ENUM('standard','addon','private','vip','makeup_session')
    NOT NULL DEFAULT 'standard',
  MODIFY COLUMN publication_status ENUM('draft','published','archived','cancelled')
    NOT NULL DEFAULT 'draft',
  MODIFY COLUMN participant_visibility ENUM('visible','hidden','invite_only')
    NOT NULL DEFAULT 'visible',
  MODIFY COLUMN enrollment_mode ENUM('self_select','organizer_assign_only','invite_accept','purchase_required')
    NOT NULL DEFAULT 'self_select',
  MODIFY COLUMN requires_separate_entitlement BOOLEAN NOT NULL DEFAULT FALSE;
```

**Step 2 — Extend session_selections:**

```sql
ALTER TABLE session_selections
  ADD COLUMN assignment_source ENUM(
    'self_selected','organizer_assigned','invite_accepted','waitlist_promoted','addon_purchase'
  ) NULL,
  ADD COLUMN assigned_by_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN assigned_at DATETIME NULL,
  ADD COLUMN assignment_notes TEXT NULL;

UPDATE session_selections SET assignment_source = 'self_selected'
WHERE assignment_source IS NULL;

ALTER TABLE session_selections
  MODIFY COLUMN assignment_source ENUM(
    'self_selected','organizer_assigned','invite_accepted','waitlist_promoted','addon_purchase'
  ) NOT NULL DEFAULT 'self_selected';
```

**Step 3 — Dual-write sync setup:**

Until `is_published` is fully deprecated, the application layer must write both `is_published` and `publication_status` on every session update. A database trigger may alternatively be used:

```sql
CREATE TRIGGER sync_is_published_from_publication_status
BEFORE UPDATE ON sessions
FOR EACH ROW
BEGIN
  IF NEW.publication_status = 'published' THEN
    SET NEW.is_published = 1;
  ELSE
    SET NEW.is_published = 0;
  END IF;
END;
```

### 14.2 Application Layer

- All existing session queries that filter on `is_published = true` must be updated to filter on `publication_status = published`.
- All existing session queries that filter on `is_published = false` must be updated to filter on `publication_status != published` or `publication_status = draft` as appropriate.
- The `SelectSessionAction` must be updated to enforce the new three-control gate.
- The `PublishSessionAction` must be updated to set `publication_status = published` (and keep `is_published = true` in sync during the transition).
- The participant selection-options endpoint query must be updated to include the new filters.

### 14.3 Backward Compatibility

All existing sessions will have `session_type = standard`, `participant_visibility = visible`, and `enrollment_mode = self_select` after migration. No behavioral change occurs for existing sessions. Existing organizer, leader, and participant workflows are unaffected until an organizer explicitly creates or modifies a session to use the new values.

---

## 15. Future Enhancements

The following enhancements are scaffolded by this design but not implemented in this phase:

### 15.1 Invite-Only Sessions

When `participant_visibility = invite_only` and `enrollment_mode = invite_accept` are activated, the system will support a session-level invite flow distinct from the existing leader invitation flow. A participant would receive an email containing a tokenized link granting access to select or accept enrollment in a specific session. This requires a new `session_invitations` table modeled similarly to `leader_invitations`.

### 15.2 Paid Add-Ons

When `enrollment_mode = purchase_required` is activated, the system will integrate with a payment provider to gate session enrollment behind a completed transaction. The `assignment_source = addon_purchase` value is already modeled in `session_selections` to record post-purchase enrollment. The `requires_separate_entitlement` boolean on the session provides a flag for the entitlement resolver to check.

### 15.3 Waitlists for Add-On Sessions

When `assignment_source = waitlist_promoted` is activated, participants who cannot be assigned to a full add-on session may be queued and promoted automatically or manually when a slot opens. This extends the `session_selections` waitlist flow already modeled in the base system.

### 15.4 Time-Based Selection Windows

The `selection_opens_at` and `selection_closes_at` fields are already added to the sessions table. When this feature is activated, the `SelectSessionAction` will enforce that self-selection is only permitted within the defined window. This allows organizers to control when schedule selection opens (e.g., 72 hours before a workshop starts) and closes (e.g., midnight before the event).

### 15.5 Entitlement-Based Session Access

The `requires_separate_entitlement` flag scaffolds a future path where specific sessions may be gated on plan tier or manual entitlement grant. This would be enforced in the `ResolveOrganizationEntitlementsService` and the session selection validation chain.

---

## 16. Acceptance Criteria

The following conditions must be met for this feature to be considered complete:

**Hidden sessions do not appear in selection:**
- A session with `participant_visibility = hidden` must return zero results from `GET /api/v1/workshops/{workshop}/selection-options` for any participant.

**Assigned participants see add-ons in schedule:**
- A participant assigned to a hidden add-on session via `POST /api/v1/sessions/{session}/participants` must see that session in their `GET /api/v1/workshops/{workshop}/my-schedule` response.

**Organizers can assign participants:**
- An organizer with `role IN ('owner', 'admin')` can successfully assign a registered participant to a published `organizer_assign_only` session.

**Self-selection is blocked for organizer-assign-only sessions:**
- A participant attempting `POST /api/v1/workshops/{workshop}/selections` for a session with `enrollment_mode = organizer_assign_only` receives a `422` error with code `SESSION_NOT_SELF_SELECTABLE`, regardless of the session's `participant_visibility`.

**Leaders can operate sessions normally:**
- A leader assigned to an add-on session can retrieve their roster, check in participants, and mark no-shows identically to a standard session.

**Capacity rules are enforced:**
- Assignment to a full add-on session (at capacity) fails without `force_assign: true`.
- Assignment with `force_assign: true` succeeds for `owner`/`admin` roles.
- Assignment with `force_assign: true` fails for `staff` role.

**Audit logs are created:**
- Every organizer assignment and removal action produces an `audit_logs` row with correct `entity_type`, `action`, and `metadata_json`.

**Existing sessions are backward compatible:**
- All existing sessions that were `is_published = true` have `publication_status = published`, `participant_visibility = visible`, `enrollment_mode = self_select` after migration.
- No existing participant selection or leader workflow is broken.

**`assignment_source` is recorded:**
- Self-selected rows have `assignment_source = self_selected` and `assigned_by_user_id = NULL`.
- Organizer-assigned rows have `assignment_source = organizer_assigned` and `assigned_by_user_id = <organizer users.id>`.

---

## 17. Testing Guidance

### 17.1 Unit Tests

- `ValidateSessionEnrollmentModeService` — confirm three-control gate logic returns correct pass/fail for all combinations of `publication_status`, `participant_visibility`, `enrollment_mode`.
- `SelectSessionAction` — test each of the seven self-selection conditions individually; test all seven passing simultaneously.
- `AssignParticipantToSessionAction` — test capacity enforcement, force override behavior (role-gated), and conflict warning (non-blocking).
- Backfill migration assertion — test that existing `is_published = true` rows migrate to `publication_status = published` and all other new fields receive correct defaults.

### 17.2 Integration Tests

**Happy paths:**

- Organizer creates add-on session with `session_type = addon`, `participant_visibility = hidden`, `enrollment_mode = organizer_assign_only`. Session is returned in organizer session list. Session is NOT returned in participant selection-options.
- Organizer assigns participant to add-on session. Session appears in participant's my-schedule response.
- Participant self-selects a standard visible session. `session_selections` row has `assignment_source = self_selected`.
- Leader assigned to add-on session retrieves roster containing organizer-assigned participants.

**Rejection paths:**

- Participant attempts self-selection of hidden session → `422 SESSION_NOT_VISIBLE_FOR_SELECTION`.
- Participant attempts self-selection of `organizer_assign_only` session → `422 SESSION_NOT_SELF_SELECTABLE`.
- Organizer attempts assignment to draft session → `422 SESSION_NOT_PUBLISHED`.
- Organizer assigns to full session without `force_assign` → `422 SESSION_AT_CAPACITY`.
- `staff` role attempts `force_assign` → `403 FORBIDDEN`.

### 17.3 Role-Based Authorization Tests

- Participant cannot call `POST /api/v1/sessions/{session}/participants` (any session type) → `403 FORBIDDEN`.
- Leader cannot call `POST /api/v1/sessions/{session}/participants` → `403 FORBIDDEN`.
- `staff` can call `POST /api/v1/sessions/{session}/participants` for `enrollment_mode = self_select` sessions → succeeds.
- `staff` cannot call `POST /api/v1/sessions/{session}/participants` for `enrollment_mode = organizer_assign_only` sessions → `403 FORBIDDEN`.
- `owner` can call with `force_assign: true` → succeeds at capacity.

### 17.4 Privacy and Serialization Tests

- `GET /api/v1/workshops/{workshop}/selection-options` response must contain zero records for sessions with `participant_visibility = hidden`.
- Leader serializer for session list must NOT include `participant_visibility`, `enrollment_mode`, or `requires_separate_entitlement`.
- Participant serializer for `my-schedule` must NOT include `participant_visibility`, `enrollment_mode`, `session_type`, or `assignment_source`.
- Public workshop page serializer must NOT include hidden sessions.

### 17.5 Regression Tests

Add to the regression suite defined in `TESTING_AND_VALIDATION_STRATEGY.md`:

- Hidden session does not appear in any public or participant-selection endpoint regardless of other field values.
- `enrollment_mode = organizer_assign_only` blocks self-selection regardless of `participant_visibility` value.
- Leader messaging constraints remain enforced for add-on sessions (time window and session-participant scope).
- Migrated sessions have zero behavioral change compared to pre-migration state.
- `audit_logs` row is produced for every assignment and removal action.
- Duplicate `session_selections` rows cannot be created for the same `(registration_id, session_id)` pair — assignment to a participant already in a session updates the existing row rather than inserting a new one.

### 17.6 Recommended Fixture Sets

Add the following to the standard test fixture library:

- Workshop with one standard session and one add-on session.
- Add-on session at capacity (used for force-override tests).
- Participant registered and assigned to add-on session.
- Participant registered but NOT assigned to add-on session.
- Leader assigned to add-on session.
- Leader NOT assigned to add-on session (for access boundary tests).

---

*This document is v1. Future revisions will cover invite-only session activation (v2), purchase-required session flows (v3), and time-window selection enforcement (v2).*
