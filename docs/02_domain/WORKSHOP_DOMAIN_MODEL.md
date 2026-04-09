# Workshop Domain Model Specification
## docs/02_domain/WORKSHOP_DOMAIN_MODEL.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Canonical field names: `docs/03_schema/DATA_SCHEMA_FULL.md` Table 11.
This file is the domain spec. The schema file overrides field names on any conflict.

---

## Workshop Types

The system must support two workshop types:

- `session_based` — participants choose from a schedule of selectable sessions
- `event_based` — simpler schedule; sessions act as schedule items; selection is
  optional or unused

The `workshop_type` field controls which workflows apply (session selection,
overlap detection, selection-required check-in, etc.).

---

## Workshop Entity

**Table: `workshops`** — see `DATA_SCHEMA_FULL.md` Table 11 for the full schema.

Key fields:

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `organization_id` | BIGINT FK | required; every workshop belongs to an organisation |
| `workshop_type` | ENUM | `session_based`, `event_based` |
| `title` | VARCHAR | required |
| `description` | TEXT | required |
| `status` | ENUM | `draft`, `published`, `archived` |
| `timezone` | VARCHAR | required; all session times inherit this |
| `start_date` | DATE | required |
| `end_date` | DATE | required |
| `join_code` | VARCHAR | required; unique; system-generated |
| `default_location_id` | BIGINT FK nullable | fallback location for sessions |
| `public_page_enabled` | BOOLEAN | default false |
| `public_slug` | VARCHAR nullable | unique; used for public URL routing |
| `header_image_url` | VARCHAR nullable | S3/CloudFront URL; added Phase 11 |
| `created_at`, `updated_at` | DATETIME | |

---

## Core Rules

- Every workshop **must** belong to an organisation (`organization_id` required).
- A workshop **must** have a `join_code`. It is system-generated and unique across
  the platform. Organisers do not set it manually.
- A workshop **must** define a `timezone`. All `session.start_at` and `session.end_at`
  values are stored in UTC but represent times in this timezone. All workshop-related
  time calculations (leader messaging windows, etc.) use this timezone.
- A workshop **must** define `start_date` and `end_date`.
- `start_date` must not be after `end_date`.

---

## Default Location Behaviour

- A workshop may define a `default_location_id` pointing to a `locations` row.
- When a session's `location_id` is null, the system must fall back to
  `workshop.default_location_id`.
- Both `location_id` (session) and `default_location_id` (workshop) reference the
  same `locations` table.

---

## Workshop Status Lifecycle

### `draft`
- Not visible to participants.
- Fully editable.
- Participants cannot join a draft workshop.

### `published`
- Visible to registered participants.
- Must pass all publish validation rules before the status may be set to `published`.
- Participants may join via `join_code`.

### `archived`
- Read-only. No further editing.
- Not visible for new registrations.
- Existing registrations are preserved.

---

## Publish Validation Rules

A workshop cannot be published if any of the following conditions are true:

- `title` or `description` is empty
- `timezone` is null
- `start_date` or `end_date` is null, or `start_date` is after `end_date`
- For `session_based` workshops: no sessions have been created
- Any session with `delivery_type = 'virtual'` has a null `meeting_url`
- Any session with `delivery_type = 'hybrid'` and `virtual_participation_allowed = true`
  has a null `meeting_url`

Publish validation is enforced in `PublishWorkshopAction` / `ValidateWorkshopPublishService`
on the backend. The UI may reflect these errors but backend enforcement is mandatory.

---

## Hotel and Logistics Model

**Table: `workshop_logistics`** — one row per workshop (unique FK on `workshop_id`).
See `DATA_SCHEMA_FULL.md` Table 12.

Fields: `hotel_name`, `hotel_address`, `hotel_phone`, `hotel_notes`,
`parking_details`, `meeting_room_details`, `meetup_instructions`.

### Logistics Visibility

This data must appear in:
- **Participant workshop overview** — full logistics visible to registered participants
- **Public workshop page** — non-sensitive fields (hotel name and address; parking
  and meetup instructions); hotel phone is typically omitted from fully public view
- **Organiser workshop editor** — full edit access to all fields

---

## Public Page

- Enabled via `public_page_enabled = true` on the workshop.
- URL is routed via `public_slug`.
- Extended content (hero text, body copy) is stored in the `public_pages` table
  (one row per workshop, linked by `workshop_id`).
- Active meeting links must **never** appear on the public page.
- A public page is read-only to the public — it does not expose join codes,
  roster data, or any participant information.

---

## Leader Association

Workshops support leaders at two levels:

1. **Workshop level** (`workshop_leaders` table): Used for public listing on the
   workshop page. Controls whether a leader appears as a confirmed presenter.
   Only accepted leaders (`is_confirmed = true`) are shown publicly.

2. **Session level** (`session_leaders` table): Used for operational access —
   roster visibility, attendance management, messaging scope. Session assignment
   is the authoritative association for all operational capabilities.

A leader must accept their invitation before being confirmed at either level.
Session assignment is a separate action taken after invitation acceptance.

---

## Display Requirements

| Surface | Required data |
|---|---|
| Participant workshop overview | title, schedule, logistics, hotel info, public leader profiles |
| Public workshop page | description, logistics (non-sensitive), confirmed leader summaries |
| Organiser admin | all fields, full editable logistics, full session management |

---

## Audit Requirements

Log to `audit_logs`:
- workshop created
- workshop updated (especially schedule changes)
- workshop published
- workshop archived