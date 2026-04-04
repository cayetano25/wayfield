# Mobile Offline Sync Contract

## Overview

The offline sync system allows mobile clients to cache workshop data and
replay attendance actions when connectivity is restored.

---

## Endpoints

### GET /api/v1/workshops/{workshop}/sync-version

Returns the current version hash for the workshop sync package.

**Auth:** Bearer token. Accessible to:
- Registered participants
- Leaders assigned to any session in the workshop
- Organization members (owner, admin, staff)

**Response:**
```json
{
  "version_hash": "<64-char SHA-256 hex string>"
}
```

**Version hash composition (SHA-256 of pipe-delimited string):**
```
workshop.updated_at | max(sessions.updated_at) | max(workshop_logistics.updated_at) | max(session_leaders.updated_at)
```

The hash changes when any of the following changes:
- The workshop record itself is updated
- Any session is added, updated, or deleted
- Workshop logistics are updated
- A leader is added to or removed from any session

Mobile clients should poll this endpoint to detect stale packages.

---

### GET /api/v1/workshops/{workshop}/sync-package

Downloads the full offline sync package for the workshop.

**Auth:** Bearer token (same access rules as sync-version).

**Role resolution:** The role is determined server-side from the requesting user's relationship to the workshop:
- If the user is an accepted leader assigned to at least one session → `leader` role
- Otherwise → `participant` role

**Response shape:**
```json
{
  "data": {
    "version": "<SHA-256 hex>",
    "role": "participant | leader",
    "workshop": { ... },
    "logistics": { ... } | null,
    "sessions": [ ... ],
    "leaders": [ ... ],

    // Participant role only:
    "my_registration": { ... } | null,
    "my_selections": [session_id, ...],

    // Leader role only:
    "my_assigned_session_ids": [session_id, ...],
    "roster": {
      "<session_id>": [ roster_entry, ... ]
    }
  }
}
```

---

## Payload Field Inventory

### `workshop` object

| Field | Type | Notes |
|---|---|---|
| id | int | |
| title | string | |
| description | string | |
| workshop_type | string | `session_based` or `event_based` |
| status | string | |
| timezone | string | IANA timezone identifier |
| start_date | string | `YYYY-MM-DD` |
| end_date | string | `YYYY-MM-DD` |
| join_code | string | |
| default_location | object\|null | id, name, address, city |

### `logistics` object (nullable)

| Field | Type |
|---|---|
| hotel_name | string\|null |
| hotel_address | string\|null |
| hotel_phone | string\|null |
| hotel_notes | string\|null |
| parking_details | string\|null |
| meeting_room | string\|null |
| meetup_instructions | string\|null |

### `sessions` array

Each session entry:

| Field | Type | Notes |
|---|---|---|
| id | int | |
| title | string | |
| description | string\|null | |
| start_at | string | ISO 8601, stored UTC |
| end_at | string | ISO 8601, stored UTC |
| delivery_type | string | `in_person`, `virtual`, `hybrid` |
| virtual_participation_allowed | bool | |
| meeting_platform | string\|null | Platform name only (e.g. "Zoom") — safe |
| capacity | int\|null | null = unlimited |
| is_published | bool | |
| notes | string\|null | |
| track | object\|null | id, name |
| location | object\|null | id, name, city |
| leader_ids | int[] | IDs that match entries in `leaders` array |

**NEVER included in sessions:**
- `meeting_url`
- `meeting_id`
- `meeting_passcode`

### `leaders` array

All confirmed workshop leaders (`workshop_leaders.is_confirmed = true`).

Public-safe fields (all roles):

| Field | Type |
|---|---|
| id | int |
| first_name | string |
| last_name | string |
| display_name | string\|null |
| profile_image_url | string\|null |
| bio | string\|null |
| website_url | string\|null |
| city | string\|null |
| state_or_region | string\|null |

Additional fields included **only for the requesting leader's own record**:

| Field | Type |
|---|---|
| email | string\|null |
| phone_number | string\|null |
| address_line_1 | string\|null |
| address_line_2 | string\|null |
| postal_code | string\|null |
| country | string\|null |

**NEVER included for other leaders:**
- `email`
- `phone_number`
- `address_line_1`, `address_line_2`, `postal_code`, `country`

### `my_registration` (participant role only)

| Field | Type |
|---|---|
| id | int |
| registration_status | string |
| registered_at | string\|null (ISO 8601) |

### `my_selections` (participant role only)

Array of session IDs the participant has selected: `[1, 3, 7]`

### `my_assigned_session_ids` (leader role only)

Array of session IDs this leader is accepted-assigned to: `[2, 4]`

### `roster` (leader role only)

Keyed by session_id string. **Only includes sessions the requesting leader is assigned to.**
A leader assigned to Session A does NOT receive roster data for Session B.

Each roster entry:
```json
{
  "user": {
    "id": 42,
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone_number": "555-1234"
  },
  "registration_status": "registered",
  "attendance": {
    "status": "not_checked_in | checked_in | no_show",
    "check_in_method": "self | leader | null",
    "checked_in_at": "<ISO 8601> | null"
  }
}
```

**Phone number visibility:** `phone_number` is included in the leader sync package roster
because the leader is authorized. Mobile clients must NOT cache or expose this data beyond
the leader's own device.

---

## POST /api/v1/workshops/{workshop}/offline-actions

Replay a batch of offline actions captured while the device was disconnected.

**Request:**
```json
{
  "actions": [
    {
      "client_action_uuid": "<UUIDv4>",
      "action_type": "self_check_in | leader_check_in | attendance_override",
      "payload": { ... }
    }
  ]
}
```

**Payloads by action_type:**

`self_check_in`:
```json
{ "session_id": 1 }
```

`leader_check_in`:
```json
{ "session_id": 1, "participant_user_id": 42 }
```

`attendance_override`:
```json
{ "session_id": 1, "participant_user_id": 42, "status": "checked_in | no_show" }
```

**Response:**
```json
{
  "results": {
    "<client_action_uuid>": {
      "status": "applied | already_processed | rejected | unauthorized | error",
      "message": "Human-readable explanation"
    }
  }
}
```

**Idempotency:** Submitting the same `client_action_uuid` twice is safe. The second
submission returns `already_processed` and does NOT create a duplicate attendance record.

**Constraint enforcement:** All server-side rules apply during replay:
- Participant must be registered (self_check_in)
- Session selection required for session_based workshops (self_check_in)
- Leader must be assigned to the session (leader_check_in, attendance_override)
- If any constraint fails, the action returns `rejected` — other actions in the batch continue.

---

## Privacy Rules Summary

| Data | Participant Package | Leader Package |
|---|---|---|
| `meeting_url` | NEVER | NEVER |
| `meeting_id` | NEVER | NEVER |
| `meeting_passcode` | NEVER | NEVER |
| Participant `phone_number` | NEVER | Only for assigned session roster |
| Other leaders' `email` | NEVER | NEVER |
| Other leaders' address | NEVER | NEVER |
| Own leader private fields | N/A | Included (own record only) |
| Full roster | NEVER | Only assigned sessions |
