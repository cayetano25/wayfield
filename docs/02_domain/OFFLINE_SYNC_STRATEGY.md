# Offline Sync Strategy Specification
## docs/02_domain/OFFLINE_SYNC_STRATEGY.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Canonical schema: `DATA_SCHEMA_FULL.md` Tables 29–30.
Key decisions: DEC-020 (version hash includes session_leaders),
DEC-021 (meeting URLs never in sync package).

---

## Core Requirement

The mobile application must function offline after initial data sync. Participants
and leaders must be able to view workshop data and perform core operational actions
(self check-in, leader check-in) without network connectivity.

---

## Data Available Offline

The following must be accessible without connectivity after the initial sync:

- Workshop overview (title, description, dates, logistics, hotel info)
- Session schedule (all sessions, tracks, times, locations)
- Public leader profiles (safe fields only — city/state, bio, image)
- Personal participant schedule (selected sessions)
- Roster for assigned sessions (leader only — phone numbers included)

**Explicitly excluded from all sync packages:**
- `meeting_url`, `meeting_id`, `meeting_passcode` — see DEC-021
  Meeting links must be fetched live from the API. Mobile apps must handle
  the case where virtual session join links are unavailable offline and must
  prompt the user to reconnect to access them.
- Private leader address fields
- Other participants' contact data beyond what is role-appropriate

---

## Sync Version Hash

**Table: `offline_sync_snapshots`** — see `DATA_SCHEMA_FULL.md` Table 29.

The system maintains a SHA-256 version hash per workshop. The hash is computed
by `GenerateSyncVersionService` and reflects the current state of all data
included in the sync package.

**Inputs to the hash (at minimum):**
- `max(workshops.updated_at)` for the workshop
- `max(sessions.updated_at)` for all sessions in the workshop
- `max(session_leaders.updated_at)` for all session-leader assignments (DEC-020)
- `max(workshop_logistics.updated_at)`
- `max(leaders.updated_at)` for leaders associated with the workshop

DEC-020 rationale: Adding or removing a leader assignment changes the roster
data in the sync package. Without including `session_leaders` in the version hash,
mobile clients would not know to re-download after a leader assignment change.

**Mobile client behaviour:**
1. Client requests `GET /api/v1/workshops/{workshop}/sync-version`
2. Server returns the current version hash
3. Client compares to its locally cached hash
4. If hashes differ: client requests `GET /api/v1/workshops/{workshop}/sync-package`
   to download the full updated package
5. Client replaces its local cache with the new package and stores the new hash

---

## Role-Aware Sync Packages

`BuildWorkshopSyncPackageService` produces **different packages** for different roles:

### Participant Sync Package
- Workshop overview and logistics
- All published sessions (without meeting URLs)
- Public-safe leader profiles for associated leaders
- The participant's own session selections

### Leader Sync Package
- Workshop overview and logistics
- All published sessions the leader is assigned to (without meeting URLs)
- Full roster for each assigned session (including participant phone numbers)
- Own leader profile data

The service determines which package to produce based on the authenticated user's
relationship to the workshop (participant registration or leader assignment).
Meeting URLs are excluded from both variants.

---

## Initial Sync

**Trigger:** After a participant joins a workshop via join code, or after a leader
accepts a workshop assignment.

**Process:**
1. Mobile app requests the current sync version hash.
2. If the app has no cached data for this workshop (new join), it downloads the
   full sync package immediately.
3. Package is stored in device-local storage (AsyncStorage or SQLite).
4. The version hash is stored alongside the cached data for future comparison.

---

## Incremental Sync

**Trigger:** When the device comes online after being offline, or when the user
opens the app.

**Process:**
1. App requests the current sync version hash from the server.
2. If the hash matches the locally stored hash: no download needed.
3. If the hash differs: app downloads the full sync package and replaces its cache.
4. App processes any queued offline actions (see Offline Action Queue below).

**Note:** The current implementation uses a full-package replacement strategy
(not delta/patch sync). Incremental field-level syncing is a future improvement.

---

## Offline Action Queue

**Table: `offline_action_queue`** — see `DATA_SCHEMA_FULL.md` Table 30.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK | |
| `workshop_id` | BIGINT FK nullable | |
| `action_type` | ENUM | `self_check_in`, `leader_check_in`, `attendance_override` |
| `client_action_uuid` | CHAR(36) | UNIQUE; client-generated UUID; idempotency key |
| `payload_json` | JSON | action parameters |
| `processed_at` | DATETIME nullable | null until replayed |
| `created_at`, `updated_at` | DATETIME | |

### Client-Side Queue

All actions taken offline are queued locally on the device with a
client-generated UUID (`client_action_uuid`). When the device reconnects, the
queued actions are replayed to the server via `POST /api/v1/workshops/{w}/offline-actions`.

### Server-Side Replay

`ReplayOfflineActionsService` processes each action idempotently:

1. Check `client_action_uuid` against `offline_action_queue.client_action_uuid`.
2. If the UUID already exists and `processed_at` is set: skip this action (already
   replayed). Return success without re-applying.
3. If the UUID does not exist: process the action normally, create the
   `offline_action_queue` row, set `processed_at`.

Idempotency via `client_action_uuid` ensures that:
- Duplicate `attendance_records` rows are never created
- Network retries do not cause double check-ins
- Out-of-order replays produce consistent state

---

## Conflict Resolution

### Attendance

If a participant or leader checks in offline and the server already has a
`checked_in` record for that user/session (e.g., from another device or a leader
override), the server reconciles using these rules:

- If the server record is `not_checked_in`: apply the offline action.
- If the server record is already `checked_in`: treat as already-processed;
  return success without overwriting `checked_in_at` or `check_in_method`.
- If the server record is `no_show`: the offline action does not override a
  leader's no-show mark. Return the current state to the client.

The `client_action_uuid` uniqueness constraint prevents duplicate rows even
if the same offline action is submitted multiple times.

---

## Failure Handling

- Retries must occur automatically on the mobile client with exponential backoff.
- The user must be notified if sync fails after repeated attempts.
- The user must be notified when major updates (new sessions, schedule changes)
  are available upon reconnecting.
- Stale data must be clearly indicated in the UI if the device has been offline
  for an extended period.

---

## Security Rules

- Sensitive data stored locally must be minimised.
- No unnecessary PII is persisted in the local cache beyond what is needed for
  offline operation.
- Meeting URLs are never cached locally (DEC-021).
- Leader roster data (including phone numbers) is only included in the leader
  sync package for assigned sessions, never in the participant package.
- Local storage should be cleared when the user logs out.