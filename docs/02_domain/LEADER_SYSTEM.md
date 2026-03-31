# Leader System Specification

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
Canonical schema: `DATA_SCHEMA_FULL.md` Tables 14–19
This file is the domain spec source of truth for the leader lifecycle.

---

## Leader Entity

Table: leaders (see DATA_SCHEMA_FULL.md Table 14)

Fields:
- id
- user_id (nullable FK — null until invitation is accepted and account is linked)
- first_name (required)
- last_name (required)
- display_name (optional)
- bio (optional)
- profile_image_url (optional)
- website_url (optional)
- email (optional)
- phone_number (optional — private)
- address_line_1 (optional — private)
- address_line_2 (optional — private)
- city (optional)
- state_or_region (optional)
- postal_code (optional — private)
- country (optional — private)
- created_at
- updated_at

---

## Core Rules

- Leaders are global entities, not scoped to a single organization
- Leaders may belong to multiple organizations (via organization_leaders table)
- Leader profile is owned and maintained by the leader, not the inviting organizer
- A leader record may exist before the leader has created a user account
- Organizers may create placeholder leader records if needed

---

## Leader Invitations

Table: leader_invitations (see DATA_SCHEMA_FULL.md Table 16)

Fields:
- id
- organization_id (FK)
- workshop_id (nullable FK) — optional; invitation may be to an organization generally
- leader_id (nullable FK) — null until accepted and leader record is created/linked
- invited_email (required)
- invited_first_name (optional — organizer placeholder only)
- invited_last_name (optional — organizer placeholder only)
- status (enum: pending, accepted, declined, expired, removed)
- invitation_token_hash (hashed; raw token sent in email link only)
- expires_at
- responded_at (nullable)
- created_by_user_id (FK)
- created_at
- updated_at

Note: `session_id` is NOT a field on leader_invitations. Invitations are scoped to
an organization and optionally a workshop. Session assignment is handled after
acceptance via the `session_leaders` junction table — see Session Assignment below.

---

## Invitation Flow

1. Organizer sends invitation (specifying organization_id and optionally workshop_id)
2. System creates leader_invitations row with status = 'pending'
3. System sends invitation email with tokenized acceptance link
4. Leader clicks link → token validated against invitation_token_hash
5. Leader accepts or declines:
   - Accept: leader completes/confirms profile, user account is created or linked,
     leader_invitations.status = 'accepted', organization_leaders row created
   - Decline: leader_invitations.status = 'declined'
6. Organizer may then assign leader to specific sessions via session_leaders

---

## Session Assignment (Post-Acceptance)

After a leader has accepted an invitation, organizers assign them to sessions:

Table: session_leaders (DATA_SCHEMA_FULL.md Table 19)
- session_id (FK)
- leader_id (FK)
- role_label (optional — e.g., "Lead Instructor", "Assistant")

Rules:
- A session supports multiple leaders
- A leader may be assigned to multiple sessions
- Roster access, phone number visibility, and messaging scope are all derived
  from session-level assignment, not workshop-level association
- Leaders must NOT access sessions they are not assigned to

Table: workshop_leaders (DATA_SCHEMA_FULL.md Table 17)
- workshop_id (FK)
- leader_id (FK)
- is_confirmed (boolean)

Workshop-level association controls public listing on the workshop page only.
It does NOT grant operational access (roster, attendance, messaging).

---

## Profile Ownership Rules

- Organizers may create a placeholder record (first_name, last_name, email)
- Organizers must NOT be required or forced to fill in leader bio or personal details
- After accepting an invitation, the leader owns and controls:
  - first_name, last_name
  - bio
  - website_url
  - phone_number
  - city, state_or_region
  - mailing/street address (stored privately)
  - profile_image_url
- Profile data is reusable across organizations and workshops

---

## Public Visibility Rules

Only show on public/participant-facing surfaces:
- first_name, last_name
- display_name (if present)
- profile_image_url
- bio (snippet or full)
- website_url
- city
- state_or_region

Never expose publicly:
- email
- phone_number
- address_line_1, address_line_2, postal_code, country

Only accepted (invitation status = 'accepted') and confirmed (is_confirmed = true)
leaders should appear publicly on workshop pages.

---

## Validation Rules

- A leader must accept their invitation before:
  - appearing publicly as a confirmed leader on any workshop page
  - being assigned to sessions in a confirmed capacity
  - accessing any roster or participant data

---

## Audit Requirements

Log to audit_logs:
- invitation sent
- invitation accepted (including which leader and organization)
- invitation declined
- leader profile completed (first meaningful profile update post-acceptance)
- leader assigned to session
- leader removed from session
