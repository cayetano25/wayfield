# Session and Capacity Model Specification
## docs/02_domain/SESSION_AND_CAPACITY_MODEL.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Canonical field names: `docs/03_schema/DATA_SCHEMA_FULL.md` Table 18.
Session leader assignment: `DATA_SCHEMA_FULL.md` Table 19 (`session_leaders`).
This file is the domain spec. The schema file overrides field names on any conflict.

---

## Session Entity

**Table: `sessions`** — see `DATA_SCHEMA_FULL.md` Table 18 for the full schema.

Key fields:

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `workshop_id` | BIGINT FK | required |
| `track_id` | BIGINT FK nullable | optional grouping |
| `title` | VARCHAR | required |
| `description` | TEXT nullable | |
| `start_at` | DATETIME | required; stored in UTC |
| `end_at` | DATETIME | required; stored in UTC |
| `location_id` | BIGINT FK nullable | overrides `workshop.default_location_id` if set |
| `capacity` | INT nullable | null = unlimited; number = enforced limit |
| `delivery_type` | ENUM | `in_person`, `virtual`, `hybrid` |
| `virtual_participation_allowed` | BOOLEAN | controls hybrid meeting_url requirement |
| `meeting_platform` | VARCHAR nullable | e.g. Zoom, Google Meet |
| `meeting_url` | VARCHAR nullable | required before publish for virtual/qualifying hybrid |
| `meeting_instructions` | TEXT nullable | |
| `meeting_id` | VARCHAR nullable | |
| `meeting_passcode` | VARCHAR nullable | |
| `notes` | TEXT nullable | |
| `is_published` | BOOLEAN | default false |
| `header_image_url` | VARCHAR nullable | S3/CloudFront URL; added Phase 11 |
| `created_at`, `updated_at` | DATETIME | |

**Important:** There is no `leader_id` FK on the `sessions` table. Leaders are
assigned to sessions via the `session_leaders` junction table (DEC-012). A session
may have multiple leaders.

---

## Time Field Conventions

- Time fields are `start_at` and `end_at` (DATETIME, stored UTC). The older names
  `start_time`/`end_time` appear in earlier documentation and are incorrect.
- Timezone is inherited from the parent workshop's `timezone` field.
- All time-based calculations (leader messaging windows, publish validation, display
  to users) must convert from UTC using the parent workshop's timezone. Never perform
  these calculations in UTC or the server's local timezone.

---

## Core Rules

- Every session must belong to a workshop (`workshop_id` required).
- `start_at` must be before `end_at`.
- Timezone is inherited from the parent workshop. Sessions do not have their own
  timezone field.

---

## Capacity Rules

- `capacity = NULL` means **unlimited**. This must never be treated as zero.
  `EnforceSessionCapacityService` skips enforcement entirely when capacity is null.
- When `capacity` is a positive integer, the backend must enforce the limit at every
  relevant point.

### Capacity Enforcement Points

Capacity must be checked and enforced at:
1. **Session selection** — when a participant attempts to select the session
   (`session_selections` creation)
2. **Organiser add** — when an organiser manually adds a participant to a session
   (Phase 14 endpoint: `POST /api/v1/workshops/{w}/sessions/{s}/participants`)
3. **Check-in** — for event-based workshops, or for any session where direct
   check-in occurs without prior selection

Enforcement uses `SELECT … FOR UPDATE` database locking to prevent race conditions
during simultaneous selection. See DEC-011.

### Capacity Visibility

- **Organiser admin** must display: total capacity, current confirmed count, remaining slots.
- **Participant UI** may display remaining availability.

---

## Session Published State

Sessions use `is_published` (BOOLEAN), not a status enum.

- `is_published = false` — draft; not visible to participants
- `is_published = true` — published; visible to registered participants

Sessions have no archived state. Deactivation behavior is TBD (see
`docs/stabilization/OPEN_QUESTIONS.md`).

---

## Session Selection Rules

### Session-based workshops

- Participants may select sessions.
- Overlapping sessions (where `start_at`/`end_at` ranges conflict) must not both
  be selectable. `DetectSelectionConflictService` enforces this.
- Capacity is enforced at selection time.
- Selected sessions appear in the participant's personal schedule.
- A participant who has checked in to a session cannot deselect it
  (`CannotDeselectCheckedInSessionException`).

### Event-based workshops

- Session selection is optional or unused.
- Sessions are primarily informational schedule items.
- Capacity is still enforced if `capacity` is set and check-in is used.
- Check-in eligibility for event-based workshops requires registration only —
  no session selection is needed. `SelfCheckInAction` must handle this distinction.

---

## Location Rules

- A session with a non-null `location_id` uses that location.
- A session with a null `location_id` falls back to `workshop.default_location_id`.
- Both reference the `locations` table.

---

## Delivery Type Rules

### `in_person`

- `meeting_url` is not required.
- No virtual meeting fields required.
- Publishing is not blocked by virtual field state.

### `virtual`

- `meeting_url` is required before the session can be published.
- Publishing is blocked if `meeting_url` is null.
- Participant-facing UI must display a "Join Meeting" action.
- The meeting link should open in the appropriate platform/app where possible.

### `hybrid`

- The `virtual_participation_allowed` field (BOOLEAN) controls whether virtual
  access is offered to participants for this specific hybrid session.
- **`virtual_participation_allowed = true`**: `meeting_url` is required before
  publishing. Participant-facing UI must show a "Join Meeting" action.
- **`virtual_participation_allowed = false`**: `meeting_url` is not required.
  The session is in-person; no virtual join action is shown to participants.

This field resolves the open question from earlier documentation. It is implemented
in the schema and is the authoritative control for hybrid meeting_url requirements.

### Virtual Field Privacy

`meeting_url`, `meeting_id`, and `meeting_passcode` must never appear in:
- Fully public workshop or session endpoints (e.g. `GET /api/v1/public/workshops/{slug}`)
- Offline sync packages

These fields are visible only to authenticated registered participants (and org
`owner`/`admin`/`staff`). `PublicSessionResource` and `BuildWorkshopSyncPackageService`
must both explicitly exclude these fields.

---

## Publish Validation

A session cannot be published if:
- `delivery_type = 'virtual'` and `meeting_url` is null
- `delivery_type = 'hybrid'` and `virtual_participation_allowed = true` and
  `meeting_url` is null
- `start_at` is not before `end_at`

`ValidateVirtualSessionPublishService` enforces virtual/hybrid conditions.

---

## Audit Requirements

Log to `audit_logs`:
- session created
- session published
- session capacity reached
- session updated (particularly schedule changes, which are "important workshop changes")