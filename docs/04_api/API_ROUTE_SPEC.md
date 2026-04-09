# API Route Specification
## docs/04_api/API_ROUTE_SPEC.md

**Source authority:** `MASTER_PROMPT.md`
**Service boundaries:** `docs/04_api/API_AND_SERVICE_BOUNDARIES.md`

Conventions:
- All responses are JSON
- Versioned prefix: `/api/v1` for tenant API, `/api/platform/v1` for platform API
- Authenticated routes require `Authorization: Bearer {token}` unless noted
- All protected routes enforce tenant and role boundaries
- Role values referenced are stored enum values from `organization_users.role`
- "Organizer-level" means `owner` or `admin` unless specified otherwise

---

# Part 1 — Tenant API (`/api/v1/*`)

---

## 1. Authentication Routes

### POST /api/v1/auth/register
Auth: none

Request: `first_name`, `last_name`, `email`, `password`, `password_confirmation`,
`onboarding_intent` (optional: `organizer`, `participant`)

Behavior: creates user, creates email auth_method row, dispatches EmailVerificationMail.
If `onboarding_intent` is provided, sets `users.onboarding_status`.

Response: user summary, verification pending status

---

### POST /api/v1/auth/login
Auth: none

Request: `email`, `password`, `platform` (optional: `web`, `ios`, `android`)

Behavior: validates credentials, creates Sanctum token, creates user_sessions row,
records login_events entry.

Response: auth token, user summary (includes `onboarding_completed_at`, memberships)

---

### POST /api/v1/auth/logout
Auth: required

Behavior: revokes Sanctum token, updates user_sessions.

---

### POST /api/v1/auth/forgot-password
Auth: none

Request: `email`

Behavior: creates password_reset_tokens row if account exists, dispatches PasswordResetMail.
Always returns 200 to avoid email enumeration.

---

### POST /api/v1/auth/reset-password
Auth: none

Request: `email`, `token`, `password`, `password_confirmation`

Behavior: verifies token hash, updates password_hash, deletes reset token.

---

### GET /api/v1/auth/verify-email/{id}/{hash}
Auth: none (tokenized link)

Behavior: validates hash, sets `email_verified_at`.

---

### POST /api/v1/auth/resend-verification
Auth: required

Behavior: dispatches EmailVerificationMail.

---

## 2. Two-Factor Authentication Routes (501 Stubs)

All routes below return HTTP 501 Not Implemented. Schema is ready; feature not active.

### POST /api/v1/auth/two-factor/enable
### POST /api/v1/auth/two-factor/confirm
### POST /api/v1/auth/two-factor/disable
### POST /api/v1/auth/two-factor/challenge
### GET /api/v1/auth/two-factor/recovery-codes
### POST /api/v1/auth/two-factor/recovery-codes

---

## 3. User / Profile Routes

### GET /api/v1/me
Auth: required

Response: id, first_name, last_name, email, phone_number, profile_image_url,
email_verified_at, onboarding_status, onboarding_completed_at, memberships
(organization_id, organization_name, role per org)

---

### PATCH /api/v1/me
Auth: required

Allowed fields: `first_name`, `last_name`, `phone_number`, `profile_image_url`

---

### POST /api/v1/me/onboarding/complete
Auth: required

Request: `{ "completed": true }`

Behavior: sets `users.onboarding_completed_at` to now.

---

### GET /api/v1/me/organizations
Auth: required

Response: array of organization summaries with role per org.

---

### GET /api/v1/me/notifications
Auth: required

Response: paginated in-app notifications for the authenticated user.

---

### PATCH /api/v1/me/notifications/{notificationRecipient}/read
Auth: required

Behavior: sets in_app_status = 'read', read_at = now.

---

### GET /api/v1/me/notification-preferences
Auth: required

### PUT /api/v1/me/notification-preferences
Auth: required

Request: `email_enabled`, `push_enabled`, `in_app_enabled`, `workshop_updates_enabled`,
`reminder_enabled`, `marketing_enabled`

---

### POST /api/v1/me/push-tokens
Auth: required

Request: `platform` (ios, android), `push_token`

Behavior: creates or updates push_tokens row (UNIQUE on push_token).

---

### DELETE /api/v1/me/push-tokens/{pushToken}
Auth: required

Behavior: sets is_active = false.

---

## 4. Organisation Routes

### GET /api/v1/organizations
Auth: required

Response: organisations where the authenticated user has an organization_users row.

---

### POST /api/v1/organizations
Auth: required

Request: `name`, `slug`, `primary_contact_first_name`, `primary_contact_last_name`,
`primary_contact_email`, `primary_contact_phone`

Behavior: creates organisation, creates owner membership, creates subscriptions row
(plan = 'free'), checks plan limits.

---

### GET /api/v1/organizations/{organization}
Auth: required | Role: any member

---

### PATCH /api/v1/organizations/{organization}
Auth: required | Role: owner, admin

---

### GET /api/v1/organizations/{organization}/dashboard
Auth: required | Role: owner, admin, staff

Response: dashboard metrics including active_workshops, total_participants,
upcoming_sessions, recent_activity. Plan-aware: Starter+ returns attendance_rate,
capacity_utilization; Pro returns registration_trend (12 weeks).

---

## 5. Organisation Member Management

### GET /api/v1/organizations/{organization}/users
Auth: required | Role: owner, admin

Response: list of organization_users with user details and role.

---

### PATCH /api/v1/organizations/{organization}/users/{organizationUser}
Auth: required | Role: owner (any role change); admin (staff, billing_admin only)

Request: `role`, `is_active`

Behavior: validates last-owner constraint before demoting an owner.

---

### DELETE /api/v1/organizations/{organization}/users/{organizationUser}
Auth: required | Role: owner (anyone); admin (staff, billing_admin only)

Behavior: sets is_active = false. Validates last-owner constraint. Writes audit_logs.

---

### POST /api/v1/organizations/{organization}/transfer-ownership
Auth: required | Role: owner only

Request: `{ "user_id": 123 }`

Behavior: target user must be an active member. Sets target role = 'owner', current
owner role = 'admin'. Writes audit_logs.

---

## 6. Organisation Member Invitations

### GET /api/v1/organizations/{organization}/invitations
Auth: required | Role: owner, admin

Response: list of pending organization_invitations.

---

### POST /api/v1/organizations/{organization}/invitations
Auth: required | Role: owner, admin

Request: `invited_email`, `invited_role` (admin, staff, or billing_admin), optional message.

Behavior: creates organization_invitations row, dispatches OrgMemberInvitationMail.

---

### DELETE /api/v1/organizations/{organization}/invitations/{invitation}
Auth: required | Role: owner, admin

Behavior: cancels pending invitation (sets status = 'expired').

---

### POST /api/v1/organizations/{organization}/invitations/{invitation}/resend
Auth: required | Role: owner, admin

Behavior: generates new token, resets expiry, dispatches OrgMemberInvitationMail.

---

### GET /api/v1/organization-invitations/{token}
Auth: none (tokenized)

Response: invitation context (org name, role being offered, inviting person).

---

### POST /api/v1/organization-invitations/{token}/accept
Auth: none initially (creates or links account during acceptance)

Behavior: validates token, creates organization_users row. If no account exists,
includes registration; if account exists, prompts login first.

---

### POST /api/v1/organization-invitations/{token}/decline
Auth: none (tokenized)

Behavior: sets invitation status = 'declined'.

---

## 7. Subscription and Entitlement Routes

### GET /api/v1/organizations/{organization}/subscription
Auth: required | Role: owner, billing_admin

---

### GET /api/v1/organizations/{organization}/entitlements
Auth: required | Role: any member

Response: resolved feature entitlements for UI-layer gating. Backend enforcement
is always primary.

---

## 8. Location Routes

### GET /api/v1/organizations/{organization}/locations
### POST /api/v1/organizations/{organization}/locations
Auth: required | Role: owner, admin, staff

### PATCH /api/v1/locations/{location}
### DELETE /api/v1/locations/{location}
Auth: required | Role: owner, admin, staff

---

## 9. Workshop Routes

### GET /api/v1/organizations/{organization}/workshops
Auth: required | Role: owner, admin, staff

Filters: status, workshop_type, date range.

---

### POST /api/v1/organizations/{organization}/workshops
Auth: required | Role: owner, admin, staff

Request: `workshop_type`, `title`, `description`, `timezone`, `start_date`, `end_date`,
`default_location_id`, `public_page_enabled`, `header_image_url`

Behavior: generates join_code, enforces plan workshop limit.

---

### GET /api/v1/workshops/{workshop}
Auth: required | Role: any member (serializer varies by role)

---

### PATCH /api/v1/workshops/{workshop}
Auth: required | Role: owner, admin, staff

---

### POST /api/v1/workshops/{workshop}/publish
Auth: required | Role: owner, admin

Behavior: validates title, description, timezone, sessions, virtual session rules.

---

### POST /api/v1/workshops/{workshop}/archive
Auth: required | Role: owner, admin

---

### GET /api/v1/workshops/{workshop}/logistics
### PUT /api/v1/workshops/{workshop}/logistics
Auth: required | Role: owner, admin, staff

---

### GET /api/v1/workshops/{workshop}/analytics
Auth: required | Role: owner, admin, staff (plan-gated: Starter+)

Response: attendance rate, no-show rate, capacity utilization, session breakdown,
registration trend (Pro only).

---

## 10. Track Routes

### GET /api/v1/workshops/{workshop}/tracks
### POST /api/v1/workshops/{workshop}/tracks
### PATCH /api/v1/tracks/{track}
### DELETE /api/v1/tracks/{track}
Auth: required | Role: owner, admin, staff

---

## 11. Session Routes

### GET /api/v1/workshops/{workshop}/sessions
Auth: required (serializer varies: OrganizerSessionResource vs ParticipantSessionResource)

---

### POST /api/v1/workshops/{workshop}/sessions
Auth: required | Role: owner, admin, staff

Request: `track_id`, `title`, `description`, `start_at`, `end_at`, `location_id`,
`capacity`, `delivery_type`, `virtual_participation_allowed`, `meeting_platform`,
`meeting_url`, `meeting_instructions`, `meeting_id`, `meeting_passcode`, `notes`,
`header_image_url`

---

### GET /api/v1/sessions/{session}
Auth: required (serializer varies by role/context)

---

### PATCH /api/v1/sessions/{session}
Auth: required | Role: owner, admin, staff

---

### POST /api/v1/sessions/{session}/publish
Auth: required | Role: owner, admin

Validation: meeting_url required where delivery_type = 'virtual' or (delivery_type = 'hybrid'
and virtual_participation_allowed = true).

---

### GET /api/v1/workshops/{workshop}/my-schedule
Auth: required | Participant only

Response: participant's selected sessions for the workshop.

---

## 12. Session Participant Management (Phase 14)

### GET /api/v1/organizations/{organization}/participants/search
Auth: required | Role: owner, admin, staff

Query params: `email`, `workshop_id`

Response: registered participants matching the email query for the given workshop.
Used to find participants to add to sessions.

---

### POST /api/v1/workshops/{workshop}/sessions/{session}/participants
Auth: required | Role: owner, admin, staff

Request: `{ "user_id": 123 }`

Behavior: validates registration, enforces capacity (SELECT…FOR UPDATE), creates or
re-activates session_selections row, creates attendance_records row, writes audit_logs.

---

### DELETE /api/v1/workshops/{workshop}/sessions/{session}/participants/{user}
Auth: required | Role: owner, admin, staff

Behavior: cancels session_selections row (selection_status = 'canceled').
Does not delete attendance_records. Writes audit_logs.

---

## 13. Registration and Join Routes

### POST /api/v1/workshops/join
Auth: required

Request: `{ "join_code": "ABC123" }`

Behavior: creates registrations row if workshop is published and user is not already
registered. Triggers WorkshopJoinConfirmationMail.

---

### GET /api/v1/workshops/{workshop}/registration
Auth: required

Response: current user's registration state for this workshop.

---

### DELETE /api/v1/workshops/{workshop}/registration
Auth: required

Behavior: cancels registration if business rules allow.

---

## 14. Session Selection Routes

### GET /api/v1/workshops/{workshop}/selection-options
Auth: required | Participant

Response: selectable sessions with capacity state.

---

### POST /api/v1/workshops/{workshop}/selections
Auth: required | Participant

Request: `{ "session_id": 42 }`

Validation: registration exists, no time conflict, capacity available (SELECT…FOR UPDATE).

---

### DELETE /api/v1/workshops/{workshop}/selections/{session}
Auth: required | Participant

Validation: participant has not already checked in (CannotDeselectCheckedInSessionException).

---

## 15. Leader Admin and Invitation Routes

### GET /api/v1/organizations/{organization}/leaders
Auth: required | Role: owner, admin, staff

---

### POST /api/v1/organizations/{organization}/leaders/invitations
Auth: required | Role: owner, admin

Request: `invited_email`, `invited_first_name`, `invited_last_name`, `workshop_id` (optional)

Behavior: creates leader_invitations row, dispatches LeaderInvitationMail.

---

### GET /api/v1/leader-invitations/{token}
Auth: none (tokenized)

Response: invitation context (org name, workshop if applicable, who invited).

---

### POST /api/v1/leader-invitations/{token}/accept
Auth: none initially

Request: profile fields — `first_name`, `last_name`, `bio`, `website_url`,
`phone_number`, `city`, `state_or_region`, address fields

Behavior: validates token, creates/links leaders record, creates organization_leaders
row, creates workshop_leaders row if workshop_id set, writes audit_logs.

---

### POST /api/v1/leader-invitations/{token}/decline
Auth: none (tokenized)

---

## 16. Leader Self-Service Routes

### GET /api/v1/leader/profile
Auth: required | Leader (user must have leaders.user_id = auth user id)

---

### PATCH /api/v1/leader/profile
Auth: required | Leader

Allowed fields: `first_name`, `last_name`, `bio`, `website_url`, `phone_number`,
`city`, `state_or_region`, address fields, `profile_image_url`

---

### GET /api/v1/leader/sessions
Auth: required | Leader

Response: sessions where session_leaders.leader_id matches the auth user's leader record.

---

### GET /api/v1/leader/workshops
Auth: required | Leader

---

## 17. Workshop/Session Leader Assignment Routes

### POST /api/v1/workshops/{workshop}/leaders
Auth: required | Role: owner, admin

Request: `{ "leader_id": 5 }`

---

### POST /api/v1/sessions/{session}/leaders
Auth: required | Role: owner, admin

Request: `{ "leader_id": 5, "role_label": "Lead Instructor" }`

Behavior: creates session_leaders row with assignment_status = 'pending'.

---

### PATCH /api/v1/sessions/{session}/leaders/{leader}
Auth: required | Role: owner, admin

Request: `{ "assignment_status": "accepted" }` or `{ "role_label": "..." }`

---

### DELETE /api/v1/sessions/{session}/leaders/{leader}
Auth: required | Role: owner, admin

---

## 18. Attendance and Roster Routes

### GET /api/v1/sessions/{session}/roster
Auth: required | Role: owner/admin/staff (all participants) or assigned leader (own session)

Enforces: tenant check, role check, leader assignment check, phone visibility rules.

---

### POST /api/v1/sessions/{session}/check-in
Auth: required | Participant

Behavior: validates registration (and session selection for session-based workshops).
Creates or updates attendance_records row.

---

### POST /api/v1/sessions/{session}/attendance/{user}/leader-check-in
Auth: required | Assigned leader (assignment_status = 'accepted')

---

### POST /api/v1/sessions/{session}/attendance/{user}/no-show
Auth: required | Assigned leader (assignment_status = 'accepted')

---

### GET /api/v1/workshops/{workshop}/attendance-summary
Auth: required | Role: owner, admin, staff

---

## 19. Notification Routes

### GET /api/v1/workshops/{workshop}/notifications
Auth: required | Role: owner, admin, staff, or assigned leader (own session notifications)

---

### POST /api/v1/workshops/{workshop}/notifications
Auth: required | Role: owner/admin/staff (broad scopes) or leader (session scope only)

Request: `title`, `message`, `notification_type`, `delivery_scope`, `session_id` (required for leaders)

Validation: sender role allowed; leader scope/time window enforced;
delivery scope valid for role; `custom` delivery_scope returns 501.

---

### GET /api/v1/workshops/{workshop}/notifications/{notification}
Auth: required | Role: owner, admin, staff, or notification creator

Response: full notification content (no truncation).

---

## 20. Public Workshop Routes

### GET /api/v1/public/workshops/{slug}
Auth: none

Response (PublicWorkshopResource): title, description, logistics (non-sensitive),
confirmed leader summaries (public-safe fields only), session schedule (no meeting URLs).

Must exclude: private roster data, participant data, meeting URLs, private leader address.

---

## 21. Workshop Discovery Routes

### GET /api/v1/discover/workshops
Auth: none

Response: paginated list of published workshops with public_page_enabled = true.
Includes: title, description, dates, public leader thumbnails, location info.
Excludes: all private data, meeting URLs.

---

### GET /api/v1/discover/workshops/{slug}
Auth: none

Response: same as public workshop page — PublicWorkshopDiscoveryResource.

---

## 22. Offline Sync Routes

### GET /api/v1/workshops/{workshop}/sync-version
Auth: required | Registered participant or assigned leader

Response: `{ "version_hash": "sha256..." }`

---

### GET /api/v1/workshops/{workshop}/sync-package
Auth: required | Registered participant or assigned leader

Response: role-aware offline data package. Participant package excludes meeting URLs.
Leader package includes assigned-session roster (with phone numbers).
Both exclude meeting_url, meeting_id, meeting_passcode.

---

### POST /api/v1/workshops/{workshop}/offline-actions
Auth: required

Request: array of `{ "client_action_uuid": "uuid", "action_type": "...", "payload": {...} }`

Behavior: idempotent replay via client_action_uuid uniqueness. Already-processed
UUIDs are skipped (not re-applied).

---

## 23. Reporting Routes

### GET /api/v1/organizations/{organization}/reports/attendance
Auth: required | Role: owner, admin, staff | Plan: Starter+

### GET /api/v1/organizations/{organization}/reports/workshops
Auth: required | Role: owner, admin, staff | Plan: Starter+

### GET /api/v1/organizations/{organization}/reports/usage
Auth: required | Role: owner, admin | Plan: Starter+

---

## 24. File Upload Routes

### POST /api/v1/files/presigned-url
Auth: required

Request: `{ "filename": "photo.jpg", "content_type": "image/jpeg", "context": "workshop_header" }`

Behavior: generates S3 presigned URL for direct browser upload. Returns presigned URL
and the storage_key to use for confirmation.

Response: `{ "presigned_url": "...", "storage_key": "..." }`

---

### POST /api/v1/files/confirm
Auth: required

Request: `{ "storage_key": "...", "entity_type": "workshop", "entity_id": 42 }`

Behavior: confirms the file was uploaded to S3, creates files row, updates the
entity's image URL field.

---

### POST /api/v1/files/local-upload
Auth: required
Environment: local development only

Behavior: accepts a file upload directly (bypasses S3 presigned URL flow).
Returns storage_key for confirmation. Unavailable in staging/production.

---

## 25. Audit Log Routes

### GET /api/v1/organizations/{organization}/audit-logs
Auth: required | Role: owner, admin

Response: paginated audit events. Filterable by entity_type, action, date range.

---

## 26. Enterprise Routes (Phase 9 — Partial)

### GET /api/v1/organizations/{organization}/webhooks
### POST /api/v1/organizations/{organization}/webhooks
### PATCH /api/v1/organizations/{organization}/webhooks/{endpoint}
### DELETE /api/v1/organizations/{organization}/webhooks/{endpoint}
Auth: required | Role: owner, admin | Plan: Pro+

---

### GET /api/v1/organizations/{organization}/api-keys
### POST /api/v1/organizations/{organization}/api-keys
### DELETE /api/v1/organizations/{organization}/api-keys/{apiKey}
Auth: required | Role: owner, admin | Plan: Pro+

---

### GET /api/v1/system/announcements
Auth: required

Response: active system_announcements for display in the admin shell.

---

# Part 2 — External API (`/api/v1/external/*`)

Auth: `X-Api-Key: {raw_key}` verified against `api_keys.secret_hash`.
Plan requirement: Pro+ for the associated organisation.
Tenant is resolved from the API key.

### GET /api/v1/external/workshops
Response: published workshops for the organisation.

### GET /api/v1/external/workshops/{workshop}/sessions
Response: published sessions for the workshop.

### GET /api/v1/external/workshops/{workshop}/participants/count
Response: `{ "count": 42 }`

---

# Part 3 — Platform API (`/api/platform/v1/*`)

Auth: `Authorization: Bearer {admin_token}` verified against admin_users via
`auth:platform_admin` guard. Tenant tokens are rejected on all platform routes.

---

## P1. Platform Auth

### POST /api/platform/v1/auth/login
Auth: none

Request: `email`, `password`

Response: admin token, admin user summary

---

### POST /api/platform/v1/auth/logout
Auth: platform required

---

## P2. Platform Dashboard

### GET /api/platform/v1/overview
Auth: platform required | Role: any admin role

Response: platform-level metrics — total organisations, MRR, active users,
plan distribution, recent signups.

---

## P3. Platform Organisation Management

### GET /api/platform/v1/organizations
Auth: platform required | Role: admin, super_admin, support, billing

Filters: plan, status, search.

---

### GET /api/platform/v1/organizations/{org}
Auth: platform required | Role: admin, super_admin, support, billing

Response: full organisation detail including usage metrics and billing state.

---

### POST /api/platform/v1/organizations/{org}/feature-flags
Auth: platform required | Role: admin, super_admin

Request: `{ "feature_key": "...", "is_enabled": true }`

Behavior: creates or updates feature_flags row with source = 'manual_override'.
Writes platform_audit_logs entry.

---

### POST /api/platform/v1/organizations/{org}/billing/plan
Auth: platform required | Role: billing, super_admin

Request: `{ "plan_code": "starter" }`

Behavior: updates subscriptions row, writes platform_audit_logs entry.

---

## P4. Platform User Management

### GET /api/platform/v1/users
Auth: platform required | Role: admin, super_admin, support

---

### GET /api/platform/v1/users/{user}
Auth: platform required | Role: admin, super_admin, support

Response: user detail including login history (login_events) and org memberships.

---

## P5. Platform Financials

### GET /api/platform/v1/financials/overview
Auth: platform required | Role: billing, super_admin

Response: MRR, ARR, subscription counts by plan.

---

### GET /api/platform/v1/financials/invoices
Auth: platform required | Role: billing, super_admin

---

## P6. Platform Health and Security

### GET /api/platform/v1/health
Auth: none

Response: application health check.

---

### GET /api/platform/v1/security/events
Auth: platform required | Role: admin, super_admin, support

---

## P7. Platform Audit Logs

### GET /api/platform/v1/audit-logs
Auth: platform required | Role: admin, super_admin

Response: paginated platform_audit_logs. Filterable by admin_user_id, organization_id,
action, date range.

---

## P8. Platform System Announcements

### GET /api/platform/v1/system/announcements
### POST /api/platform/v1/system/announcements
### PATCH /api/platform/v1/system/announcements/{announcement}
### DELETE /api/platform/v1/system/announcements/{announcement}
Auth: platform required | Role: admin, super_admin

---

## P9. Platform Admin Management

### GET /api/platform/v1/admins
### POST /api/platform/v1/admins
Auth: platform required | Role: super_admin only

### PATCH /api/platform/v1/admins/{adminUser}
### DELETE /api/platform/v1/admins/{adminUser}
Auth: platform required | Role: super_admin only

Rules: cannot remove the last super_admin. Role cannot be changed to super_admin
by anyone other than an existing super_admin.

---

## Common Enforcement Rules

All routes enforce:
1. Correct authentication guard for the API layer
2. Email verification where required
3. Tenant scope check on every org/workshop/session resource
4. Role check against stored enum values — never conceptual terms
5. Resource ownership check (resource belongs to the org in context)
6. Specific business rule checks (capacity, time window, plan gate)
7. Audit logging for sensitive operations

No route relies on UI-level hiding as a substitute for backend enforcement.