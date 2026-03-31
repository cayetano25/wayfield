# Workshop Domain Model Specification

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
Canonical field names: `DATA_SCHEMA_FULL.md` Table 11
This file is a domain spec. The schema file overrides field names on conflict.

---

## Workshop Types

The system must support two workshop types:

1. SESSION_BASED
2. EVENT_BASED

---

## Workshop Entity

Table: workshops (see DATA_SCHEMA_FULL.md Table 11)

Fields:
- id (PK)
- organization_id (FK, required)
- workshop_type (enum: session_based, event_based)
- title (required)
- description (required)
- status (enum: draft, published, archived)
- start_date (required)
- end_date (required)
- timezone (required)
- join_code (required, unique)
- default_location_id (nullable FK)
- public_page_enabled (boolean, default false)
- public_slug (nullable, unique)
- created_at
- updated_at

---

## Core Rules

- Every workshop MUST belong to an organization
- A workshop MUST have a join_code (unique, system-generated)
- A workshop MUST define a timezone
- A workshop MUST define start_date and end_date
- Timezone is inherited by all sessions within the workshop

---

## Default Location Behavior

- A workshop may define a default location
- If a session does NOT define its own location:
  → system MUST fall back to workshop.default_location_id

---

## Workshop Status Rules

draft:
- not visible to participants
- fully editable

published:
- visible to participants
- must meet validation rules before publish:
  - title and description present
  - at least one session defined (for session_based workshops)
  - all virtual/hybrid sessions have meeting_url
  - timezone defined

archived:
- read-only
- not visible for new registrations

---

## Hotel and Logistics Model

Table: workshop_logistics (see DATA_SCHEMA_FULL.md Table 12)

Fields:
- workshop_id (FK, unique — one row per workshop)
- hotel_name
- hotel_address
- hotel_phone
- hotel_notes
- parking_details
- meeting_room_details
- meetup_instructions
- created_at
- updated_at

### Logistics Visibility

This data MUST appear in:
- Participant workshop overview
- Public workshop page (non-sensitive fields)
- Organizer workshop editor (full edit access)

---

## Public Page

- Enabled via `public_page_enabled = true` on the workshop
- URL routed via `public_slug` (generation rules: open issue — see README.md)
- Extended content (hero_title, hero_subtitle, body_content) stored in `public_pages` table
  (DATA_SCHEMA_FULL.md Table 27), linked 1:1 to the workshop
- Active meeting links must NOT appear on the public page by default

---

## Leader Association

Workshops support:
- Multiple leaders associated at the workshop level (workshop_leaders table)
- Leader assignment at the session level (session_leaders table) for operational access
- Only accepted/confirmed leaders should appear publicly on the workshop page

---

## Validation Rules

A workshop cannot be published if:
- title or description is missing
- timezone is missing
- no sessions are defined (for session_based workshops only)
- any virtual or hybrid session is missing meeting_url
- start_date is after end_date

---

## Audit Requirements

Log to audit_logs:
- workshop created
- workshop updated
- workshop published
- workshop archived
