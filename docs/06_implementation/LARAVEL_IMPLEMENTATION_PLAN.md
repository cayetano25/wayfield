# Laravel Implementation Plan

## Purpose
Translate the Wayfield engineering specs into a concrete Laravel build approach suitable for phased solo development.

---

## Core Implementation Approach

Use Laravel as:
- REST API backend
- queue job runner
- authorization/policy layer
- mail integration point
- database migration/seed/test runner

Recommended style:
- thin controllers
- Form Request validation
- Eloquent models with careful scopes/relations
- service/action classes for workflows
- API Resources for serialization
- policies/gates for authorization
- queue jobs for notifications and email
- events/listeners only where they add clarity, not accidental complexity

---

## Project Setup Recommendations

### Core Packages/Capabilities
- Laravel latest stable
- Sanctum or equivalent token-based auth for SPA/mobile APIs
- queue driver configured for database locally, SQS in higher environments
- mail driver configured for local logging/dev and SES in deployed env
- storage configured for local dev and S3 in deployed env

### Environment Profiles
- local
- staging
- production

---

## Data Layer Strategy

1. Write migrations in phase order.
2. Use foreign keys consistently.
3. Add indexes during initial migration authoring, not as afterthoughts.
4. Create factories for all major entities:
   - users
   - organizations
   - workshops
   - sessions
   - leaders
   - registrations
   - attendance_records
   - notifications

5. Build seeders for:
   - minimal demo data
   - test environments only where useful

---

## Recommended Build Sequence in Laravel

### Step 1: Bootstrap Auth and Identity
Implement:
- User model
- registration/login/logout
- email verification
- password reset
- auth middleware
- current-user endpoint

Key classes:
- RegisterUserAction
- LoginUserAction
- SendVerificationEmailAction
- VerifyEmailAction
- RequestPasswordResetAction
- ResetPasswordAction

---

### Step 2: Tenant Foundation
Implement:
- Organization model
- OrganizationUser model
- Subscription model
- tenant membership queries
- organization CRUD
- role checks

Key classes:
- CreateOrganizationAction
- AddOrganizationUserAction
- UpdateOrganizationUserRoleAction
- ResolveOrganizationAccessAction

Policies:
- OrganizationPolicy
- OrganizationUserPolicy

---

### Step 3: Workshops and Logistics
Implement:
- Workshop model
- WorkshopLogistics model
- join code generator
- draft/publish/archive transitions
- organizer CRUD
- public read endpoint

Key classes:
- CreateWorkshopAction
- UpdateWorkshopAction
- PublishWorkshopAction
- ArchiveWorkshopAction
- GenerateJoinCodeService

Policies:
- WorkshopPolicy

Resources:
- OrganizerWorkshopResource
- PublicWorkshopResource

---

### Step 4: Sessions, Tracks, Capacity, and Virtual Rules
Implement:
- Track model
- Session model
- session CRUD
- publish validation
- capacity service
- overlap conflict service

Key classes:
- CreateSessionAction
- UpdateSessionAction
- PublishSessionAction
- EnforceSessionCapacityService
- DetectSelectionConflictService
- ValidateVirtualSessionPublishService

Policies:
- SessionPolicy

Resources:
- OrganizerSessionResource
- ParticipantSessionResource
- PublicSessionResource

---

### Step 5: Registration and Session Selection
Implement:
- Registration model
- SessionSelection model
- join-by-code flow
- select/deselect flow
- participant schedule endpoint

Key classes:
- JoinWorkshopByCodeAction
- SelectSessionAction
- DeselectSessionAction
- BuildParticipantScheduleService

Policies:
- RegistrationPolicy
- SessionSelectionPolicy

---

### Step 6: Leaders and Invitation Lifecycle
Implement:
- Leader model
- organization/workshop/session associations
- invitation flow
- leader self-service profile editing
- safe public serialization

Key classes:
- InviteLeaderAction
- AcceptLeaderInvitationAction
- DeclineLeaderInvitationAction
- UpdateLeaderProfileAction
- AttachLeaderToSessionAction

Policies:
- LeaderPolicy
- LeaderInvitationPolicy

Resources:
- OrganizerLeaderResource
- PublicLeaderResource
- LeaderSelfProfileResource

---

### Step 7: Attendance and Rosters
Implement:
- AttendanceRecord model
- participant self-check-in
- leader manual check-in
- no-show marking
- roster endpoint
- attendance summary endpoint

Key classes:
- SelfCheckInAction
- LeaderCheckInAction
- MarkNoShowAction
- BuildSessionRosterService
- BuildWorkshopAttendanceSummaryService

Policies:
- AttendancePolicy
- RosterPolicy

Resources:
- RosterParticipantResource
- AttendanceSummaryResource

---

### Step 8: Notifications and Messaging Enforcement
Implement:
- Notification model
- NotificationRecipient model
- PushToken model
- NotificationPreference model
- organizer composer
- leader composer with hard constraints
- queued send jobs

Key classes:
- CreateNotificationAction
- ResolveNotificationRecipientsService
- EnforceLeaderMessagingRulesService
- QueueNotificationDeliveryAction
- SendEmailNotificationJob
- SendPushNotificationJob

Policies:
- NotificationPolicy

Critical:
- leader constraints enforced in backend before recipient resolution
- audit log on all leader notifications

---

### Step 9: Offline Sync
Implement:
- sync snapshot model
- sync package endpoint
- offline action replay endpoint
- idempotent replay service

Key classes:
- BuildWorkshopSyncPackageService
- GenerateSyncVersionService
- ReplayOfflineActionsService

---

### Step 10: Reporting and Entitlements
Implement:
- entitlement resolver
- feature gate middleware/service
- reporting endpoints

Key classes:
- ResolveOrganizationEntitlementsService
- EnforceFeatureGateService
- BuildAttendanceReportService
- BuildUsageReportService

---

## Eloquent Modeling Guidance

### Use Explicit Relationships
Examples:
- User hasMany OrganizationUsers
- Organization hasMany Workshops
- Workshop hasMany Sessions
- Session belongsTo Workshop
- Session belongsToMany Leaders through session_leaders or hasMany pivot model
- Registration belongsTo User and Workshop
- AttendanceRecord belongsTo Session and User

### Prefer Query Scopes for Safety
Examples:
- scopeForOrganization($query, $organizationId)
- scopePublished($query)
- scopeVisibleToLeader($query, $leaderId)

### Avoid Hidden Magic
- keep mutators/accessors limited
- prefer explicit services for business rules

---

## Request Validation Strategy

Use Form Request classes for:
- registration
- organization create/update
- workshop create/update/publish
- session create/update/publish
- leader invitation accept/update
- selection and attendance actions
- notification create

Validation belongs in:
- request classes for input shape
- services for business rule validation
- policies for authorization

---

## Authorization Strategy

Use Policies for resource access:
- OrganizationPolicy
- WorkshopPolicy
- SessionPolicy
- LeaderPolicy
- AttendancePolicy
- NotificationPolicy

Use a dedicated tenant access resolver where helpful.

Never rely only on route visibility or frontend hiding.

---

## Serialization Strategy

Use Laravel API Resources with context-specific resources.

Do not use one universal serializer for all audiences.

Examples:
- PublicWorkshopResource
- OrganizerWorkshopResource
- ParticipantWorkshopResource
- PublicLeaderResource
- LeaderRosterResource

This is critical for privacy.

---

## Queue and Notification Strategy

Use queues for:
- invitation emails
- verification emails
- password reset emails
- organizer notifications
- leader notifications
- push delivery

Recommended local strategy:
- sync or database queue driver in local
Recommended deployed strategy:
- SQS

Jobs should be:
- idempotent where practical
- retry-safe
- structured with clear payload contracts

---

## Audit Logging Strategy

Create a central audit service:
- AuditLogService::record(...)

Call it from:
- invitation acceptance/decline
- workshop publish/archive
- attendance mutations
- leader notification creation
- auth linkage / 2FA changes if added

Avoid raw scattered insert logic.

---

## Testing Strategy in Laravel

### Unit
- services
- rule evaluators
- capacity checks
- leader messaging window checks

### Feature/Integration
- auth endpoints
- workshop CRUD
- leader invitation flow
- selection flow
- attendance flow
- notification creation flow

### Authorization Tests
- leader roster scoping
- public/private serialization
- cross-tenant denial

Use factories extensively.
Use time travel helpers for messaging window tests.

---

## Recommended Initial Milestone for a Solo Builder

Build this first vertical slice end-to-end:
1. register/login/verify
2. create organization
3. create workshop
4. create session
5. join workshop by code
6. select session
7. self-check-in

Why:
- proves shared identity
- proves tenant model
- proves workshop/session flow
- proves attendance core

Then add:
- leaders/invitations
- rosters
- constrained leader messaging

---

## Suggested Early Controllers

- AuthController
- MeController
- OrganizationController
- OrganizationUserController
- WorkshopController
- WorkshopLogisticsController
- PublicWorkshopController
- TrackController
- SessionController
- RegistrationController
- SessionSelectionController
- LeaderInvitationController
- LeaderProfileController
- LeaderAssignmentController
- AttendanceController
- RosterController
- NotificationController
- NotificationPreferenceController
- PushTokenController
- OfflineSyncController
- ReportController

Keep them thin:
- validate
- authorize
- dispatch service/action
- return resource

---

## Suggested Early Services/Actions

- RegisterUserAction
- LoginUserAction
- CreateOrganizationAction
- CreateWorkshopAction
- PublishWorkshopAction
- CreateSessionAction
- PublishSessionAction
- JoinWorkshopByCodeAction
- SelectSessionAction
- SelfCheckInAction
- InviteLeaderAction
- AcceptLeaderInvitationAction
- LeaderCheckInAction
- CreateNotificationAction
- EnforceLeaderMessagingRulesService
- BuildWorkshopSyncPackageService

---

## Definition of Done for Each Laravel Phase

A phase is not done unless:
- migrations exist
- models/relations exist
- API endpoints exist
- authorization exists
- serialization exists
- tests exist
- critical audit logging exists where required