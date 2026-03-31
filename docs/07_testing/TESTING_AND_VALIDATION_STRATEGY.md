# Testing and Validation Strategy

## Purpose
Define the regression, integration, authorization, and workflow coverage required to safely build Wayfield.

This strategy is derived from the product rules and implementation notes in the Master Prompt and related artifacts. It assumes persona-driven and regression-driven testing.

---

## Testing Principles

1. Test the real rules, not only happy paths.
2. Treat privacy, tenant isolation, and messaging scope as high-risk areas.
3. Enforce backend validation even when UI also prevents invalid actions.
4. Prefer deterministic fixtures for workshop/session timing tests.
5. Validate both role and tenant scope on every sensitive workflow.

---

## Test Categories

### 1. Unit Tests
Target:
- validators
- policy objects
- capacity service
- leader messaging window service
- selection conflict detection
- feature gate resolver

### 2. Integration Tests
Target:
- auth flows
- workshop creation flows
- invitation flows
- attendance flows
- queued notification flows

### 3. Authorization Tests
Target:
- participant role boundaries
- leader session scoping
- organizer/admin privileges
- public/private field serialization

### 4. End-to-End Workflow Tests
Target:
- participant joins workshop by code
- selects sessions
- checks in
- leader accepts invite
- leader views roster
- leader sends allowed message
- organizer publishes workshop

### 5. Regression Suites
Target:
- privacy regressions
- cross-tenant leakage
- leader access leakage
- meeting link exposure
- capacity overbooking

---

## Core Test Areas

### Identity
- register with first_name and last_name
- reject registration missing required names
- email verification required for intended access
- password reset token flow works
- login works on web/mobile clients
- auth_methods can support future provider linkage
- 2FA tables and enabling logic do not break core auth

### Person and Contact Modeling
- organization primary contact stores first and last name
- leader records require first_name and last_name
- display_name does not replace required names

### Multi-Tenant Safety
- user in organization A cannot access org B workshop admin routes
- leader linked to org A does not gain access to org B session rosters
- public endpoints do not leak tenant-internal data

### Workshops
- organizer can create draft workshop
- publish blocked when required constraints unmet
- join code unique
- logistics visible in allowed contexts
- archived workshop cannot accept new registration flows if policy disallows it

### Sessions and Capacity
- participant can select session with available capacity
- over-capacity selection is blocked
- null capacity behaves as unlimited
- overlapping sessions cannot both be selected
- virtual/hybrid publish blocked without meeting_url
- meeting_url not serialized in fully public endpoints

### Leaders
- organizer can invite leader
- leader can accept invitation
- leader can decline invitation
- expired invitation rejected
- unaccepted leader not shown publicly as confirmed
- leader can edit own profile after acceptance
- leader profile reusable across organizations

### Attendance and Rosters
- registered participant can self-check in
- unregistered participant cannot self-check in
- leader assigned to session can mark check-in
- leader unassigned to session cannot mark attendance
- leader can mark no_show only for assigned session
- organizer can see aggregate attendance
- participant cannot access private roster
- phone number visibility only appears where allowed

### Notifications and Messaging
- organizer can send broad workshop notification
- leader notification rejected without session_id
- leader notification rejected if leader not assigned
- leader notification rejected outside allowed time window
- leader notification targets only assigned session participants
- leader notification creates audit log
- delivery recipient resolution is correct

### Offline and Sync
- workshop package can be downloaded
- cached content readable offline
- offline check-in action is queued
- replay is idempotent
- sync reconciliation does not create duplicate attendance rows

### Subscription and Feature Gating
- free plan blocks gated features
- starter/pro unlock defined features
- backend blocks access even if UI is bypassed
- usage limits enforced at API layer

### Audit Logging
- workshop publish writes audit log
- leader invitation acceptance writes audit log
- leader notification writes audit log
- manual attendance override writes audit log
- auth linkage / 2FA change writes audit log

---

## High-Risk Scenarios That Must Be Explicitly Tested

1. Leader tries to message participant from another session
2. Leader tries to message within wrong time window
3. Public workshop page exposes private meeting URL
4. Public leader serializer exposes private address fields
5. Capacity race condition during simultaneous session selection
6. Cross-tenant query accidentally returns wrong organization data
7. Offline check-in replay duplicates attendance state
8. Removed or declined leader still appears publicly
9. Organizer staff role attempts billing/admin action without permission
10. Null capacity mistakenly treated as zero

---

## Recommended Test Data Fixtures

Create reusable fixture sets for:
- organization with free plan
- organization with starter plan
- organization with pro plan
- session-based workshop with overlapping sessions
- event-based workshop with capacity-limited event item
- workshop with logistics
- leader accepted / declined / pending
- virtual session and hybrid session
- time-window boundary cases:
  - exactly 4 hours before
  - 1 minute before allowed window
  - exactly session start
  - exactly session end
  - exactly 2 hours after
  - 1 minute after allowed window

---

## Acceptance Test Matrix by Persona

### Participant
- register
- verify email
- join workshop
- select sessions
- view personal schedule
- self-check-in
- view offline content

### Leader
- accept invitation
- complete profile
- view assigned sessions
- view allowed roster
- see allowed phone numbers
- check in participants
- mark no-show
- message within allowed scope/window only

### Organizer/Admin
- create organization/workshop
- manage sessions
- invite leaders
- view invitation status
- send notifications
- view attendance/reporting
- manage tenant users according to role

---

## Definition of Done Criteria for Sensitive Features

A feature is not done unless:
- happy path works
- unauthorized path is blocked
- audit logging exists where required
- tenant scope is enforced
- privacy serialization is validated
- relevant regression tests are added

---

## Tooling Recommendations

Backend:
- PHPUnit / Pest
- database transaction-backed integration tests

Web/Mobile:
- component tests where useful
- end-to-end smoke tests for critical flows

Queue/Notification:
- fake queue and notification transport in tests
- assert recipient scope and channel payload generation

---

## Release Gate Recommendation

Before each production release, run:
- auth regression suite
- tenant isolation suite
- attendance suite
- leader messaging suite
- public serialization suite
- capacity enforcement suite