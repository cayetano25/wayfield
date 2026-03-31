# API Route Specification

## Purpose
Define the backend HTTP API surface for Wayfield in a production-oriented, tenant-aware, role-aware manner.

Conventions:
- JSON API responses
- versioned prefix recommended: /api/v1
- authenticated routes require bearer auth or equivalent
- all protected routes enforce tenant and role boundaries
- route names below are representative and may be mapped to controller/action classes

---

## 1. Authentication Routes

### POST /api/v1/auth/register
Purpose:
Create a user account using email/password.

Request:
- first_name
- last_name
- email
- password
- password_confirmation

Behavior:
- creates user
- creates email auth method
- triggers verification email

Validation:
- first_name required
- last_name required
- email unique
- password meets rules

Response:
- user summary
- verification status

---

### POST /api/v1/auth/login
Purpose:
Authenticate a user.

Request:
- email
- password
- platform (optional: web, ios, android)

Behavior:
- validates credentials
- creates or updates session/token

Response:
- auth token/session payload
- user summary
- organization memberships summary

---

### POST /api/v1/auth/logout
Purpose:
Invalidate current session/token.

Auth:
- required

---

### POST /api/v1/auth/forgot-password
Purpose:
Start password reset flow.

Request:
- email

Behavior:
- generate reset token
- send email if account exists

---

### POST /api/v1/auth/reset-password
Purpose:
Complete password reset.

Request:
- email
- token
- password
- password_confirmation

---

### GET /api/v1/auth/verify-email/{id}/{hash}
Purpose:
Complete email verification.

Behavior:
- marks email_verified_at

---

### POST /api/v1/auth/resend-verification
Purpose:
Resend verification email.

Auth:
- required

---

## 2. User/Profile Routes

### GET /api/v1/me
Purpose:
Return authenticated user profile.

Response:
- id
- first_name
- last_name
- email
- verification state
- memberships

---

### PATCH /api/v1/me
Purpose:
Update authenticated user profile.

Allowed fields:
- first_name
- last_name

Optional future:
- communication preferences
- phone if user profile extension exists later

---

### GET /api/v1/me/organizations
Purpose:
Return organizations available to current user.

---

## 3. Organization Routes

### GET /api/v1/organizations
Purpose:
List organizations current user can manage or access.

Role:
- organizer/admin/staff/billing_admin as applicable

---

### POST /api/v1/organizations
Purpose:
Create organization.

Request:
- name
- slug
- primary_contact_first_name
- primary_contact_last_name
- primary_contact_email
- primary_contact_phone

Behavior:
- creates organization
- creates owner membership
- may create subscription row

---

### GET /api/v1/organizations/{organization}
Purpose:
Return organization detail.

Tenant check:
- required

---

### PATCH /api/v1/organizations/{organization}
Purpose:
Update organization metadata/contact info.

---

### GET /api/v1/organizations/{organization}/users
Purpose:
List tenant users and roles.

---

### POST /api/v1/organizations/{organization}/users
Purpose:
Add user membership or invite management user.

Request:
- user_id or email workflow if later supported
- role

---

### PATCH /api/v1/organizations/{organization}/users/{organizationUser}
Purpose:
Update role or active state.

---

## 4. Subscription/Entitlement Routes

### GET /api/v1/organizations/{organization}/subscription
Purpose:
Return plan and status.

### GET /api/v1/organizations/{organization}/entitlements
Purpose:
Return resolved feature entitlements for UI.

Behavior:
- plan-aware
- may use feature_flags overrides

---

## 5. Location Routes

### GET /api/v1/organizations/{organization}/locations
Purpose:
List reusable locations.

### POST /api/v1/organizations/{organization}/locations
Purpose:
Create location.

### PATCH /api/v1/locations/{location}
Purpose:
Update location.

### DELETE /api/v1/locations/{location}
Purpose:
Delete location if safe.

---

## 6. Workshop Admin Routes

### GET /api/v1/organizations/{organization}/workshops
Purpose:
List workshops for organizer/admin tools.

Filters:
- status
- type
- date range

---

### POST /api/v1/organizations/{organization}/workshops
Purpose:
Create workshop.

Request:
- workshop_type
- title
- description
- timezone
- start_date
- end_date
- default_location_id
- public_page_enabled

Behavior:
- generates unique join_code

---

### GET /api/v1/workshops/{workshop}
Purpose:
Return organizer-authenticated workshop detail.

Tenant check:
- required

---

### PATCH /api/v1/workshops/{workshop}
Purpose:
Update workshop.

---

### POST /api/v1/workshops/{workshop}/publish
Purpose:
Publish workshop if validation passes.

Validation:
- required fields
- session validity
- virtual rules

---

### POST /api/v1/workshops/{workshop}/archive
Purpose:
Archive workshop.

---

### GET /api/v1/workshops/{workshop}/logistics
Purpose:
Get logistics data.

### PUT /api/v1/workshops/{workshop}/logistics
Purpose:
Create/update logistics data.

---

## 7. Public Workshop Routes

### GET /api/v1/public/workshops/{slug}
Purpose:
Return public workshop page payload.

Must include only allowed public fields.

Must exclude:
- private roster data
- participant data
- active meeting URLs by default
- private leader address fields

---

## 8. Track Routes

### GET /api/v1/workshops/{workshop}/tracks
### POST /api/v1/workshops/{workshop}/tracks
### PATCH /api/v1/tracks/{track}
### DELETE /api/v1/tracks/{track}

Purpose:
Manage session-based workshop track structure.

---

## 9. Session Routes

### GET /api/v1/workshops/{workshop}/sessions
Purpose:
List sessions for organizer tools or participant-authenticated views depending on serializer.

---

### POST /api/v1/workshops/{workshop}/sessions
Purpose:
Create session.

Request:
- track_id
- title
- description
- start_at
- end_at
- location_id
- capacity
- delivery_type
- meeting_platform
- meeting_url
- meeting_instructions
- meeting_id
- meeting_passcode
- notes

Validation:
- start_at before end_at
- virtual/hybrid requirements if published

---

### GET /api/v1/sessions/{session}
Purpose:
Return session detail.

Serializer must vary by role/context.

---

### PATCH /api/v1/sessions/{session}
Purpose:
Update session.

---

### POST /api/v1/sessions/{session}/publish
Purpose:
Publish session.

Validation:
- meeting_url required where applicable

---

### GET /api/v1/workshops/{workshop}/my-schedule
Purpose:
Return participant-authenticated selected schedule.

---

## 10. Registration and Join Routes

### POST /api/v1/workshops/join
Purpose:
Join workshop via join code.

Request:
- join_code

Behavior:
- creates registration if allowed

---

### GET /api/v1/workshops/{workshop}/registration
Purpose:
Return current user registration state.

### DELETE /api/v1/workshops/{workshop}/registration
Purpose:
Cancel registration if business rules allow.

---

## 11. Session Selection Routes

### GET /api/v1/workshops/{workshop}/selection-options
Purpose:
Return selectable sessions and availability context.

### POST /api/v1/workshops/{workshop}/selections
Purpose:
Select a session.

Request:
- session_id

Validation:
- registration exists
- no conflict
- capacity available if enforced

---

### DELETE /api/v1/workshops/{workshop}/selections/{session}
Purpose:
Cancel a selection.

---

## 12. Leader Admin and Invitation Routes

### GET /api/v1/organizations/{organization}/leaders
Purpose:
List leaders associated with organization.

### POST /api/v1/organizations/{organization}/leaders/invitations
Purpose:
Invite leader.

Request:
- invited_email
- invited_first_name
- invited_last_name
- workshop_id optional

Behavior:
- creates invitation
- emails invitation link

---

### GET /api/v1/leader-invitations/{token}
Purpose:
Resolve invitation token for acceptance screen.

Public-but-tokenized:
- returns invitation context

---

### POST /api/v1/leader-invitations/{token}/accept
Purpose:
Accept invitation and create/link leader.

Request:
- first_name
- last_name
- bio optional
- website_url optional
- phone_number optional
- city optional
- state_or_region optional
- address fields optional
- profile image handling separate

---

### POST /api/v1/leader-invitations/{token}/decline
Purpose:
Decline invitation.

---

## 13. Leader Self-Service Routes

### GET /api/v1/leader/profile
Purpose:
Return current leader-owned profile if linked to authenticated user.

### PATCH /api/v1/leader/profile
Purpose:
Update leader-owned profile.

Allowed fields:
- first_name
- last_name
- bio
- website_url
- phone_number
- city
- state_or_region
- address fields
- profile image reference

---

### GET /api/v1/leader/sessions
Purpose:
Return assigned sessions for leader.

### GET /api/v1/leader/workshops
Purpose:
Return assigned workshops summary.

---

## 14. Workshop/Session Leader Assignment Routes

### POST /api/v1/workshops/{workshop}/leaders
Purpose:
Associate leader to workshop.

### POST /api/v1/sessions/{session}/leaders
Purpose:
Assign leader to session.

### DELETE /api/v1/sessions/{session}/leaders/{leader}
Purpose:
Remove leader assignment.

Rules:
- only accepted/eligible leaders should be assignable as confirmed

---

## 15. Attendance and Roster Routes

### GET /api/v1/sessions/{session}/roster
Purpose:
Return roster for organizer or assigned leader.

Must enforce:
- tenant check
- role check
- leader assignment check
- phone visibility rules

---

### POST /api/v1/sessions/{session}/check-in
Purpose:
Participant self-check-in.

Auth:
- participant required

Behavior:
- checks registration/selection eligibility
- marks attendance status

---

### POST /api/v1/sessions/{session}/attendance/{user}/leader-check-in
Purpose:
Assigned leader manually checks in participant.

---

### POST /api/v1/sessions/{session}/attendance/{user}/no-show
Purpose:
Assigned leader marks participant as no_show.

---

### GET /api/v1/workshops/{workshop}/attendance-summary
Purpose:
Organizer attendance summary.

---

## 16. Notification Routes

### GET /api/v1/workshops/{workshop}/notifications
Purpose:
List notifications visible to requester.

### POST /api/v1/workshops/{workshop}/notifications
Purpose:
Create notification.

Request:
- title
- message
- notification_type
- delivery_scope
- session_id when sender is leader

Validation:
- sender role allowed
- leader scope/time window enforced
- delivery scope valid for role

---

### GET /api/v1/me/notifications
Purpose:
Return in-app notifications for current user.

### PATCH /api/v1/me/notifications/{notificationRecipient}/read
Purpose:
Mark in-app notification as read.

---

## 17. Push Token Routes

### POST /api/v1/me/push-tokens
Purpose:
Register/update push token.

Request:
- platform
- push_token

### DELETE /api/v1/me/push-tokens/{pushToken}
Purpose:
Deactivate token.

---

## 18. Notification Preference Routes

### GET /api/v1/me/notification-preferences
### PUT /api/v1/me/notification-preferences

Purpose:
Retrieve/update per-user preferences.

---

## 19. Offline Sync Routes

### GET /api/v1/workshops/{workshop}/sync-package
Purpose:
Return mobile offline package.

Includes allowed offline data only.

### GET /api/v1/workshops/{workshop}/sync-version
Purpose:
Return current snapshot/version hash.

### POST /api/v1/workshops/{workshop}/offline-actions
Purpose:
Replay offline actions.

Request:
- list of client_action_uuid + payloads

Behavior:
- idempotent processing

---

## 20. Reporting Routes

### GET /api/v1/organizations/{organization}/reports/attendance
### GET /api/v1/organizations/{organization}/reports/workshops
### GET /api/v1/organizations/{organization}/reports/usage

Purpose:
Tenant-scoped reporting for entitled plans.

---

## 21. File Routes

### POST /api/v1/files
Purpose:
Upload file metadata / pre-signed upload flow as chosen.

### GET /api/v1/files/{file}
Purpose:
Authorized retrieval metadata.

---

## 22. Audit/Admin Routes

These may remain internal or omitted from public API at first.

### GET /api/v1/organizations/{organization}/audit-logs
Purpose:
Return audit events for privileged admin roles.

Caution:
- tightly permissioned
- paginated
- filterable by entity/action/date

---

## Common Enforcement Rules Across Routes

1. Tenant scope check on every protected organization/workshop/session resource
2. Role check on every privileged route
3. Serializer selection based on context
4. No reliance on UI-only restrictions
5. Audit logging for sensitive operations