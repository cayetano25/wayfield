# Offline Sync Strategy Specification

## Purpose
Ensure participants and leaders can operate without network connectivity.

---

## Core Requirement

Mobile application MUST function offline after initial data sync.

---

## Data Available Offline

- workshop overview
- session schedule
- leader information
- logistics and hotel info
- participant personal schedule

---

## Sync Model

### Initial Sync
- occurs after workshop join
- downloads:
  - workshop
  - sessions
  - leaders
  - logistics

---

### Incremental Sync
- triggered when online
- updates:
  - schedule changes
  - notifications
  - attendance updates

---

## Local Storage

- use device storage (AsyncStorage or SQLite)
- maintain:
  - workshop cache
  - session cache
  - user selections

---

## Conflict Resolution

### Attendance

If:
- participant checks in offline
- system syncs later

Then:
- server must accept timestamp
- reconcile with existing record

---

## Leader Offline Behavior

Leaders may:
- view roster offline
- check-in participants offline

Must:
- sync when online

---

## Sync Queue

All offline actions must:
- be queued locally
- replayed when online

---

## Failure Handling

- retries must occur automatically
- user should be notified if sync fails

---

## Data Freshness Rules

- stale data must be refreshed when connection is restored
- user should be notified if major updates occur

---

## Security Rules

- sensitive data stored locally must be minimized
- no unnecessary PII persisted