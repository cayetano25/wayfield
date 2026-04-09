# Person and Contact Modeling Specification
## docs/02_domain/PERSON_AND_CONTACT_MODEL.md

**Source authority:** `MASTER_PROMPT.md` Critical Person and Contact Modeling Rules.
This file is the domain spec for how all real people are modeled across the system.

---

## Core Rule

All real-world individuals MUST be modeled with separate `first_name` and `last_name`
fields. A single `name` field is never acceptable for any person entity in this system.

This applies to ALL of the following:
- users (the central identity table)
- leaders (the global leader profile entity)
- organisation contacts (primary contact fields on the `organizations` table)
- organisation members (via `users` — they are users with an `organization_users` row)
- participants in rosters (via `users`)
- invited leaders (placeholder records in `leaders` before account creation)

---

## Prohibited Patterns

These patterns are explicitly forbidden:
- A single `name` field as the only name representation
- Reliance on `display_name` as a substitute for `first_name` and `last_name`
- Partial identity records where one of the required name fields is null
- Any person entity that defers name collection to a later step that may never happen

---

## User Entity Required Fields

The `users` table must have:
- `first_name` — VARCHAR, NOT NULL
- `last_name` — NOT NULL
- `email` — VARCHAR, NOT NULL, UNIQUE
- `password_hash` — NOT NULL
- `phone_number` — nullable; visible only to assigned leaders and org `owner`/`admin`/`staff`

`display_name` may be derived or stored optionally but may not substitute for the
required name fields. See `DATA_SCHEMA_FULL.md` Table 1 for the full field list.

---

## Organisation Contact Model

Every organisation record must carry explicit primary contact fields. Storing only
an `organization_id` and looking up the owner's profile is not sufficient — the
contact may be a non-member external point of contact.

Required on `organizations`:
- `primary_contact_first_name` — VARCHAR, NOT NULL
- `primary_contact_last_name` — VARCHAR, NOT NULL
- `primary_contact_email` — VARCHAR, NOT NULL
- `primary_contact_phone` — VARCHAR, nullable

---

## Organisation Member Model

Organisation managers are users — they are rows in the `users` table linked to an
organisation via `organization_users`. There is no separate "admin account" type.

The `organization_users` table:
- `id`
- `organization_id` FK → organizations
- `user_id` FK → users
- `role` ENUM (`owner`, `admin`, `staff`, `billing_admin`) — NOT NULL
- `is_active` BOOLEAN — default true
- `created_at`, `updated_at`

Rules:
- An organisation must support multiple members. Never model a single owner field alone.
- Roles must be explicitly defined and stored as enum values. See `ROLE_MODEL.md`.
- One user may hold different roles in different organisations simultaneously.

---

## Leader Model

Leaders are global entities — they are not scoped to a single organisation. A leader
profile may be reused across multiple organisations and workshops.

Required fields on `leaders`:
- `first_name` — NOT NULL (may be a placeholder set by the inviting organiser)
- `last_name` — NOT NULL (same)

Optional fields on `leaders`:
- `user_id` — FK → users, nullable (null until the leader accepts their invitation)
- `display_name`
- `bio`
- `profile_image_url`
- `website_url`
- `email`
- `phone_number` — private; visible only to assigned leaders (themselves) and org owner/admin
- `address_line_1`, `address_line_2` — private
- `city`, `state_or_region` — public-safe
- `postal_code`, `country` — private

A `leaders` record may exist before it is linked to a `users` account. This supports
the invitation flow where an organiser creates a placeholder record before the leader
registers.

---

## Privacy Rules for Person Data

### Phone Numbers

`users.phone_number` and `leaders.phone_number` are private.

For participants in a roster context:
- Visible to: leaders assigned to the participant's session, and org members with
  `owner`, `admin`, or `staff` roles.
- Never visible to: other participants, unrelated leaders, public endpoints,
  `billing_admin` role.

### Leader Public Profile

Only these fields may appear on public-facing and participant-facing surfaces:
- `first_name`, `last_name`
- `display_name` (if present)
- `profile_image_url`
- `bio` (snippet or full — both acceptable)
- `website_url`
- `city`, `state_or_region`

Never expose publicly: `email`, `phone_number`, `address_line_1`, `address_line_2`,
`postal_code`, `country`.

See `PERMISSIONS_AND_PRIVACY_MODEL.md` for the full privacy rules matrix.

---

## Data Integrity Rules

- `first_name` and `last_name` are required at both the database level (NOT NULL
  constraints) and the API validation level (Form Request rules). Neither constraint
  alone is sufficient.
- `email` must be in valid format when present (confirmed by Laravel's `email`
  validation rule).
- `phone_number` must be validated for format if stored.
- These rules apply regardless of whether the record is created by the user
  themselves, by an organiser, or via an invitation flow.