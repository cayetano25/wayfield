# Leader System Specification
## docs/02_domain/LEADER_SYSTEM.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Canonical schema: `DATA_SCHEMA_FULL.md` Tables 14–19.
This file is the domain spec source of truth for the leader lifecycle.

---

## Leader Entity

**Table: `leaders`** — see `DATA_SCHEMA_FULL.md` Table 14.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK nullable | null until invitation is accepted and account is linked |
| `first_name` | VARCHAR | required |
| `last_name` | VARCHAR | required |
| `display_name` | VARCHAR nullable | optional; does not replace first/last name |
| `bio` | TEXT nullable | |
| `profile_image_url` | VARCHAR nullable | |
| `website_url` | VARCHAR nullable | |
| `email` | VARCHAR nullable | |
| `phone_number` | VARCHAR nullable | private |
| `address_line_1` | VARCHAR nullable | private |
| `address_line_2` | VARCHAR nullable | private |
| `city` | VARCHAR nullable | public-safe |
| `state_or_region` | VARCHAR nullable | public-safe |
| `postal_code` | VARCHAR nullable | private |
| `country` | VARCHAR nullable | private |
| `created_at`, `updated_at` | DATETIME | |

---

## Core Rules

- Leaders are **global entities** — not scoped to a single organisation.
- A leader profile may be associated with multiple organisations via the
  `organization_leaders` junction table.
- The leader profile is **owned and maintained by the leader**, not by the
  inviting organisation. Organisers may not be required to fill in personal details.
- A `leaders` record may exist before it is linked to a `users` account.
  `leaders.user_id` is nullable until the leader accepts their invitation.
- A leader with a linked user account may also be a participant in other workshops
  or a member of an organisation simultaneously. See
  `docs/02_domain/UNIFIED_USER_ACCOUNT.md`.

---

## Leader Invitations

**Table: `leader_invitations`** — see `DATA_SCHEMA_FULL.md` Table 16.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `organization_id` | BIGINT FK | required |
| `workshop_id` | BIGINT FK nullable | optional; invitation may be to org generally |
| `leader_id` | BIGINT FK nullable | null until accepted and leader record is created/linked |
| `invited_email` | VARCHAR | required |
| `invited_first_name` | VARCHAR nullable | organiser placeholder only |
| `invited_last_name` | VARCHAR nullable | organiser placeholder only |
| `status` | ENUM | `pending`, `accepted`, `declined`, `expired`, `removed` |
| `invitation_token_hash` | VARCHAR | hashed; raw token sent in email link only — see DEC-013 |
| `expires_at` | DATETIME | |
| `responded_at` | DATETIME nullable | |
| `created_by_user_id` | BIGINT FK | |
| `created_at`, `updated_at` | DATETIME | |

**DEC-014 — No `session_id` on `leader_invitations`:** Invitations are scoped to an
organisation and optionally a workshop. Session assignment is a separate action taken
after acceptance (see Session Assignment below). Conflating invitation with session
assignment creates workflow rigidity. The `session_id` field does not exist and must
not be added to this table.

---

## Invitation Flow

1. Organisation `owner` or `admin` sends an invitation (email address, optional
   `workshop_id`).
2. System creates a `leader_invitations` row with `status = 'pending'` and a
   hashed invitation token.
3. System dispatches `LeaderInvitationMail` (queued) with a tokenised acceptance link.
   The raw token is never stored.
4. Leader clicks the link. Token is hashed and compared to `invitation_token_hash`.
5. Leader **accepts** or **declines**:
   - **Accept**: `AcceptLeaderInvitationAction` runs:
     - Creates or links a `leaders` record to the leader's `users` account
       (a new account is created if the invited email has no existing account)
     - Creates an `organization_leaders` row
     - If `workshop_id` was set, creates a `workshop_leaders` row
     - Sets `leader_invitations.status = 'accepted'` and `responded_at`
     - Writes `audit_logs` entry
   - **Decline**: Sets `status = 'declined'` and `responded_at`. Writes `audit_logs`.
6. After acceptance, the organiser assigns the leader to specific sessions (see below).

---

## Session Assignment (Post-Acceptance)

Session assignment is a **separate, explicit action** taken after invitation
acceptance. It is not part of the invitation flow.

**Table: `session_leaders`** — `DATA_SCHEMA_FULL.md` Table 19.

| Field | Type | Notes |
|---|---|---|
| `session_id` | BIGINT FK | |
| `leader_id` | BIGINT FK | |
| `role_label` | VARCHAR nullable | e.g. "Lead Instructor", "Assistant" |
| `assignment_status` | ENUM | `pending`, `accepted`, `declined` |
| `created_at`, `updated_at` | DATETIME | |

**Rules:**
- A session may have multiple leaders.
- A leader may be assigned to multiple sessions.
- `assignment_status` must be `accepted` for the leader to have operational
  access (roster viewing, check-in, attendance override, messaging). A leader
  with `assignment_status = 'pending'` or `'declined'` is not yet active for
  that session.
- Roster access, participant phone number visibility, and messaging scope are all
  derived from `session_leaders` assignment — not from `workshop_leaders` or
  `organization_leaders`.
- Leaders must not access sessions they are not assigned to.

**Workshop-level association (`workshop_leaders`):**
Controls public listing on the workshop page only. A `workshop_leaders` row with
`is_confirmed = true` makes the leader appear publicly as a confirmed presenter.
It does **not** grant operational access (roster, attendance, messaging).

---

## Profile Ownership Rules

- Organisers may create a placeholder `leaders` record with `first_name`,
  `last_name`, and `email` before the leader has registered.
- After accepting their invitation, the leader owns and controls their profile:
  `first_name`, `last_name`, `bio`, `website_url`, `phone_number`, `city`,
  `state_or_region`, address fields, `profile_image_url`.
- Organisation `owner`/`admin` staff must not be required to fill in a leader's
  personal details.
- Leader profile data is reusable across organisations and workshops.
  The same `leaders` record may be linked to multiple organisations.

---

## Public Visibility Rules

Only these fields may appear on public-facing and participant-facing surfaces:

- `first_name`, `last_name`
- `display_name` (if present)
- `profile_image_url`
- `bio` (snippet or full — both acceptable)
- `website_url`
- `city`, `state_or_region`

**Never expose publicly:**
- `email`
- `phone_number`
- `address_line_1`, `address_line_2`, `postal_code`, `country`

Only leaders with `leader_invitations.status = 'accepted'` and
`workshop_leaders.is_confirmed = true` appear publicly on workshop pages.

---

## Validation Rules

A leader must have accepted their invitation before:
- Appearing publicly as a confirmed leader on any workshop page
- Being assigned to sessions in a confirmed operational capacity
- Accessing any roster or participant data

---

## Invitation Token Security

Invitation tokens are stored hashed in `invitation_token_hash`. The raw token is
generated at invitation creation time, placed in the email link, and never stored.
Token verification hashes the incoming token and compares it to the stored hash.
See DEC-013.

---

## Audit Requirements

Log to `audit_logs`:
- invitation sent (includes `organization_id`, `invited_email`, `workshop_id` if set)
- invitation accepted (includes which leader and organisation)
- invitation declined
- leader profile completed (first meaningful profile update post-acceptance)
- leader assigned to session
- leader removed from session