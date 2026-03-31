# Phased Implementation Plan

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
Product scope authority: `docs/01_product/MVP_SCOPE.md`
Tactical task breakdown: `BUILD_SEQUENCE_CHECKLIST.md`
Code generation prompts: `PHASE_PROMPTS.md`

## Purpose
Provide a build order that matches architectural dependency and solo-builder execution practicality.

This phase plan aligns with the previously defined phased delivery model. It preserves the existing sequence of foundation first, domain next, then operational workflows and hardening.

---

## Phase 0 – Architecture and Project Setup

### Goal
Establish project foundation, repository structure, environments, deployment direction, coding standards, and shared technical conventions.

### Scope
- create backend repository and Laravel project
- create web admin/public app structure
- create Expo mobile project
- define environment strategy
- configure database connections
- configure queue infrastructure
- configure email provider scaffolding
- configure storage strategy
- define folder/module conventions
- set up CI/CD baseline
- set up linting, formatting, and testing baseline

### Deliverables
- repo structure
- local dev environment
- environment variable template
- AWS baseline decision record
- coding standards
- CI pipeline

### Exit Criteria
- apps boot locally
- database connectivity works
- queue worker runs
- email test path works
- deployment path is chosen

---

## Phase 1 – Identity, People, Tenant Foundation, and Auth Extensions

### Goal
Build shared identity, person modeling, and multi-tenant foundations.

### Scope
- users
- organizations
- organization_users
- subscriptions
- auth_methods scaffold
- user session management
- email/password auth
- email verification
- password reset
- person/contact modeling
- future-ready 2FA tables

### Deliverables
- migrations
- auth endpoints
- user profile endpoints
- organization membership model
- email verification flow
- password reset flow

### Exit Criteria
- user can register
- user can verify email
- user can log in on web/mobile
- user profile uses first_name and last_name
- organization manager relationships work

---

## Phase 2 – Workshops, Locations, and Public Pages

### Goal
Support workshop creation and public workshop display.

### Scope
- locations
- workshops
- workshop_logistics
- public page scaffolding
- join_code generation
- workshop status transitions
- workshop editor
- public workshop overview

### Deliverables
- workshop CRUD
- logistics CRUD
- public page endpoint
- workshop validation rules

### Exit Criteria
- organizer can create workshop
- public workshop page renders allowed information
- join code exists and is unique
- logistics appear in organizer and participant/public contexts appropriately

---

## Phase 3 – Tracks, Sessions, Selections, Capacity, and Virtual Delivery

### Goal
Support workshop schedules, participant session selection, optional capacity, and virtual session rules.

### Scope
- tracks
- sessions
- session publish validation
- capacity enforcement
- overlapping session conflict checks
- session selection flow
- meeting_url validation for virtual/hybrid

### Deliverables
- session CRUD
- track CRUD
- session selection endpoints
- capacity checking service
- participant schedule endpoint

### Exit Criteria
- participant can select valid sessions
- conflicting selections blocked
- capacity enforced when present
- meeting links required before publish where needed

---

## Phase 4 – Leaders, Invitations, and Self-Managed Profiles

### Goal
Support reusable leaders, trust-based invitation workflows, and leader-owned profile completion.

### Scope
- leaders
- organization_leaders
- leader_invitations
- workshop_leaders
- session_leaders
- invitation acceptance flow
- leader profile completion/editing
- public leader visibility rules

### Deliverables
- leader CRUD
- invitation send/accept/decline
- leader profile screens/endpoints
- safe public serialization rules

### Exit Criteria
- organizer can invite leader
- leader can accept invitation
- leader can complete and edit profile
- only accepted leaders appear publicly as confirmed

---

## Phase 5 – Attendance, Roster, Leader Messaging, and Operational Views

### Goal
Support participant self-check-in, leader operational roster management, and tightly constrained leader messaging.

### Scope
- registrations
- session_selections linkage to attendance eligibility
- attendance_records
- self-check-in
- leader override
- no-show marking
- roster views
- participant phone number visibility rules
- leader messaging time-window and scope rules
- audit logging for leader messaging

### Deliverables
- attendance services
- roster APIs
- permission checks
- leader notification service
- audit logging hooks

### Exit Criteria
- participant self-checks in
- leader sees attendance state for assigned session
- leader overrides when needed
- organizer sees aggregate attendance
- phone number privacy rules enforced
- leader can message only allowed session participants in allowed time window
- leader messages are logged and auditable

---

## Phase 6 – Notifications, Transactional Email, Preferences, and Auth Hardening

### Goal
Build operational communication systems and identity hardening scaffolding.

### Scope
- notifications
- notification_recipients
- push_tokens
- notification preferences
- transactional email templates
- queued delivery
- auth_methods expansion readiness
- 2FA activation path scaffolding

### Deliverables
- notification composer endpoints
- queued send jobs
- in-app notification center endpoints
- push registration endpoints
- user preference endpoints

### Exit Criteria
- organizer notifications deliver through configured channels
- leader notifications remain constrained
- in-app notifications can be retrieved
- preference scaffolding exists
- auth hardening schema ready for future enablement

---

## Phase 7 – Offline Sync, Packaging, and Mobile Resilience

### Goal
Make mobile experience durable in low-connectivity field conditions.

### Scope
- offline sync package generation
- sync versioning
- local cache model
- offline check-in queue
- action replay and reconciliation rules

### Deliverables
- sync endpoints
- version hash generation
- offline action reconciliation service
- mobile sync contract

### Exit Criteria
- workshop content available offline after sync
- offline check-ins queue and replay correctly
- stale package can be refreshed when online resumes

---

## Phase 8 – Reporting, Feature Gating, and Plan Enforcement

### Goal
Operationalize SaaS plan enforcement and analytics/reporting foundations.

### Scope
- subscription checks
- feature flag resolution
- workshop/participant/workflow usage limits
- attendance summaries
- reporting endpoints
- admin analytics foundation

### Deliverables
- plan gate middleware/services
- usage counting services
- reporting endpoints
- attendance summary views

### Exit Criteria
- restricted features blocked at backend
- plan-aware UI can query entitlements
- usage limits are enforced consistently

---

## Phase 9 – Enterprise Readiness and Future Extensions

### Goal
Prepare for enterprise and advanced extensions without re-architecting.

### Scope
- SSO planning hooks
- stronger governance controls
- webhooks
- API expansion
- integration scaffolding
- discovery/search planning

### Deliverables
- interface boundaries
- future integration architecture notes
- enterprise auth extension plan

### Exit Criteria
- system remains extensible without major schema rewrite
- enterprise roadmap has explicit attachment points