# Module Boundaries Specification

## Purpose
Define backend module boundaries so the Laravel implementation remains maintainable, testable, and extensible.

Guiding principles:
- organize around business domains
- keep controllers thin
- place core logic in services/actions/domain policies
- make authorization explicit
- isolate notification and audit side effects behind services/events

---

## Recommended High-Level Backend Modules

1. Auth
2. Identity
3. Organizations
4. Billing/Plans
5. Workshops
6. Scheduling
7. Leaders
8. Registrations
9. Attendance
10. Notifications
11. OfflineSync
12. Files
13. Audit
14. Shared Infrastructure

---

## 1. Auth Module

Responsibilities:
- registration
- login/logout
- email verification
- password reset
- session/token lifecycle

Owns:
- auth-related controllers/actions
- password reset workflows
- verification workflows

Depends on:
- Identity module for user entity
- Audit module for auth event logging

Must not own:
- organization membership business rules beyond onboarding linkage

---

## 2. Identity Module

Responsibilities:
- user profile
- auth method linkage
- 2FA scaffolding
- user session metadata

Owns:
- users
- auth_methods
- user_2fa_methods
- user_2fa_recovery_codes
- user_sessions

Depends on:
- Shared Infrastructure
- Audit module

---

## 3. Organizations Module

Responsibilities:
- organization CRUD
- primary contact modeling
- organization membership/roles
- tenant scoping helpers

Owns:
- organizations
- organization_users

Depends on:
- Identity module for users
- Billing/Plans for subscription/entitlement lookups
- Audit module

---

## 4. Billing/Plans Module

Responsibilities:
- subscriptions
- feature flags
- entitlement resolution
- usage limit checks

Owns:
- subscriptions
- feature_flags
- plan resolution services

Used by:
- Workshops
- Notifications
- Reporting
- Admin UI entitlement endpoints

Must not:
- directly implement payment processor concerns yet unless added later

---

## 5. Workshops Module

Responsibilities:
- workshop CRUD
- logistics
- public page representation
- join code lifecycle
- publish/archive transitions

Owns:
- workshops
- workshop_logistics
- public_pages

Depends on:
- Organizations
- Locations from Scheduling or shared domain
- Audit

---

## 6. Scheduling Module

Responsibilities:
- tracks
- sessions
- locations
- capacity enforcement
- selection conflicts
- meeting validation
- participant schedule assembly

Owns:
- locations
- tracks
- sessions
- session-level validation services

Depends on:
- Workshops
- Leaders
- Registrations
- Audit

---

## 7. Leaders Module

Responsibilities:
- leader profile
- leader invitations
- organization/ workshop / session leader associations
- leader-owned profile updates

Owns:
- leaders
- organization_leaders
- leader_invitations
- workshop_leaders
- session_leaders

Depends on:
- Identity when leader is linked to user
- Organizations
- Workshops/Scheduling
- Notifications for invitation email
- Audit

---

## 8. Registrations Module

Responsibilities:
- workshop registration
- join-by-code handling
- session selections
- waitlist-ready logic if enabled later

Owns:
- registrations
- session_selections

Depends on:
- Workshops
- Scheduling
- Billing/Plans if participant/workshop caps are enforced by plan
- Audit

---

## 9. Attendance Module

Responsibilities:
- self-check-in
- leader check-in
- no-show marking
- roster assembly
- attendance summaries

Owns:
- attendance_records
- attendance business services
- roster serializers

Depends on:
- Registrations
- Scheduling
- Leaders
- Organizations
- Audit

Must not:
- directly send notifications without going through Notifications module

---

## 10. Notifications Module

Responsibilities:
- notification creation
- recipient resolution
- queued delivery
- in-app notification retrieval
- push token registration
- user preferences
- leader messaging constraint enforcement service

Owns:
- notifications
- notification_recipients
- push_tokens
- notification_preferences

Depends on:
- Organizations
- Workshops
- Scheduling
- Leaders
- Registrations/Attendance for recipient resolution
- Billing/Plans for gating
- Audit

Critical note:
- leader scope/time-window validation should live here or in a dedicated policy service consumed here

---

## 11. OfflineSync Module

Responsibilities:
- snapshot/version generation
- offline package assembly
- offline replay handling
- idempotent action reconciliation

Owns:
- offline_sync_snapshots
- offline_action_queue if used

Depends on:
- Workshops
- Scheduling
- Leaders
- Registrations
- Attendance
- Notifications as needed

---

## 12. Files Module

Responsibilities:
- file metadata
- upload policy coordination
- storage key management

Owns:
- files

Depends on:
- Shared Infrastructure storage client
- Audit if uploads are sensitive

---

## 13. Audit Module

Responsibilities:
- audit event recording
- structured action metadata
- retrieval for admin/internal tooling

Owns:
- audit_logs
- audit event service

Dependencies:
- none business-critical; other modules depend on it

Important:
- should be easy to call from anywhere
- should not create circular domain dependencies

---

## 14. Shared Infrastructure

Responsibilities:
- base models
- queue abstraction
- mail abstraction
- storage abstraction
- common response helpers
- exception handling
- policy helpers
- time utilities

Must not:
- contain domain business logic that should live in modules

---

## Cross-Module Rules

1. Controllers call actions/services, not raw business logic.
2. Authorization should occur before mutation services where practical.
3. Services may depend on repositories/models, but avoid tight cross-module coupling.
4. Audit writes should happen through the Audit module, not ad hoc inserts everywhere.
5. Notifications should not be sent directly from unrelated modules; use the Notifications module or domain events.

---

## Suggested Laravel Folder Shape

app/
  Domain/
    Auth/
    Identity/
    Organizations/
    Billing/
    Workshops/
    Scheduling/
    Leaders/
    Registrations/
    Attendance/
    Notifications/
    OfflineSync/
    Files/
    Audit/
  Http/
    Controllers/
    Requests/
    Resources/
  Policies/
  Providers/
  Support/

Alternative:
- keep Http grouped by domain as well, if preferred, but remain consistent