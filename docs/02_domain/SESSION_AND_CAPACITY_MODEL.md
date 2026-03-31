# Session and Capacity Model Specification

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
Canonical field names: `DATA_SCHEMA_FULL.md` Table 18
Session leader assignment: `DATA_SCHEMA_FULL.md` Table 19 (`session_leaders`)
This file is a domain spec. The schema file overrides field names on conflict.

---

## Session Entity

Table: sessions (see DATA_SCHEMA_FULL.md Table 18)

Fields:
- id (PK)
- workshop_id (FK, required)
- track_id (nullable FK)
- title (required)
- description (nullable)
- start_at (DATETIME, required) — stored in UTC; timezone inherited from workshop
- end_at (DATETIME, required) — stored in UTC; timezone inherited from workshop
- location_id (nullable FK) — overrides workshop default_location_id if set
- capacity (nullable integer)
- delivery_type (enum: in_person, virtual, hybrid)
- meeting_platform (nullable)
- meeting_url (nullable)
- meeting_instructions (nullable)
- meeting_id (nullable)
- meeting_passcode (nullable)
- notes (nullable)
- is_published (boolean, default false)
- created_at
- updated_at

Note: Sessions support multiple leaders via the `session_leaders` junction table
(DATA_SCHEMA_FULL.md Table 19). There is no `leader_id` FK on sessions.

---

## Core Rules

- Every session MUST belong to a workshop
- start_at must be before end_at
- Timezone is inherited from the parent workshop; all window calculations
  (including leader messaging windows) must be performed in the workshop's timezone

---

## Capacity Rules

- capacity may be NULL → means unlimited; treat NULL as unlimited, never as zero
- If capacity is NOT NULL:
  → system MUST enforce limit in backend business logic
  → UI may display remaining capacity but MUST NOT be the only enforcement

### Capacity Enforcement Points

Must be enforced at:
- session selection (session_selections creation)
- check-in (for event-based workshops or sessions without mandatory selection)

Rule: confirmed participants must NOT exceed capacity.

### Concurrency Warning

Simultaneous session selection creates a race condition risk.
Enforcement must use database-level locking (SELECT ... FOR UPDATE or equivalent).
This is a high-risk scenario — see README.md Open Issues.

### Capacity Visibility

Organizer UI must display:
- total capacity
- current confirmed count
- remaining slots

Participant UI may display availability status.

---

## Session State

Sessions use `is_published BOOLEAN` (not a status enum like workshops).

- `is_published = false` → draft; not visible to participants
- `is_published = true` → published; visible to registered participants

There is no archived state for sessions. Session deletion or deactivation behavior
is an open question (see README.md Open Issues — soft delete strategy).

---

## Session Selection Rules (session_based workshops)

- Participants may select sessions
- Overlapping sessions must NOT both be selectable unless a future override policy exists
- Capacity must be enforced when selection_status becomes 'selected'
- Selection is recorded in session_selections (DATA_SCHEMA_FULL.md Table 21)

### Event-based Workshops

- Session selection is optional or unused
- Schedule is primarily informational
- Capacity is still enforced if capacity is set and RSVP/check-in is used
- Check-in eligibility when no session_selections row exists must be handled explicitly
  in the attendance service — registration alone is sufficient for event-based check-in

---

## Location Rules

- Session may define its own location_id
- If location_id is null, system falls back to workshop.default_location_id
- Both workshop and session locations reference the locations table

---

## Delivery Type Rules

### in_person
- meeting_url is not required
- no virtual meeting fields required

### virtual
- meeting_url REQUIRED before session can be published
- publishing is blocked if meeting_url is absent
- participant-facing UI must display a "Join Meeting" action
- opening the link should use the appropriate platform/app where possible

### hybrid
- meeting_url REQUIRED if virtual participation is enabled for participants
- OPEN ISSUE: There is currently no `virtual_participation_allowed` field or equivalent
  on the sessions table to indicate which hybrid sessions require meeting_url.
  This flag must be resolved before Phase 3 implementation.
  See README.md Open Issues.

### Virtual Access Privacy
- meeting_url, meeting_id, meeting_passcode must NEVER appear in public workshop endpoints
- Visible only to authenticated registered participants (and org staff+)

---

## Validation Rules

A session cannot be published if:
- delivery_type is virtual AND meeting_url is null
- delivery_type is hybrid AND virtual participation is enabled AND meeting_url is null
- start_at is not before end_at

---

## Audit Requirements

Log to audit_logs:
- session created
- session published
- session capacity reached
- session updated (schedule changes are "important workshop changes" per MASTER_PROMPT.md)
