# Full Data Schema Specification
## docs/03_schema/DATA_SCHEMA_FULL.md

**Authority:** This document is the canonical field-name authority for the Wayfield
schema. When domain documents and this document conflict on field names or types,
this document governs. When MASTER_PROMPT.md behavioral rules conflict with this
document, MASTER_PROMPT.md governs.

**Schema target:** MySQL (AWS RDS)

This document is organized in two parts:
- **Part 1 — Tenant Schema** (tables 1–39): All tables used by the tenant-facing
  application (`/api/v1/*`). Authenticated via `auth:sanctum` / `users` table.
- **Part 2 — Platform Schema** (tables 40–55): Tables used by the Command Center
  platform admin application (`/api/platform/v1/*`). Authenticated via
  `auth:platform_admin` / `admin_users` table. Includes the deprecated
  `platform_admins` table.

---

## Schema Design Principles

1. All real people are modeled with separate `first_name` and `last_name` fields.
   A single `name` field is never used.
2. Multi-tenant scoping is explicit. Every protected resource has an `organization_id`
   or traverses to one.
3. Role is never stored on the `users` table. It is derived from relationships.
4. Privacy-sensitive data is handled with least-privilege access patterns.
5. Future auth and enterprise enhancements are modeled now, even if not active.
6. Capacity, permissions, and messaging constraints are enforced by backend business
   logic, not only UI.
7. Meeting URLs (`meeting_url`, `meeting_id`, `meeting_passcode`) are never included
   in public endpoints or offline sync packages.

---

# Part 1 — Tenant Schema

---

## 1. users

Purpose: Canonical account entity for shared identity across all roles and surfaces.
One `users` record per person. Role is derived from relationships, not this table.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- email VARCHAR(255) NOT NULL UNIQUE
- password_hash VARCHAR(255) NOT NULL
  — Column name is `password_hash`, not `password`. User model overrides
  `getAuthPassword()` and `getAuthPasswordName()`. See DEC-004.
- email_verified_at DATETIME NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- last_login_at DATETIME NULL
- phone_number VARCHAR(50) NULL
  — Subject to same visibility rules as roster phone numbers.
  — Visible to assigned leaders and org owner/admin/staff. Never public.
- profile_image_url VARCHAR(500) NULL
  — S3/CloudFront URL. Added Phase 11 (image uploads).
- onboarding_status VARCHAR(50) NULL
  — Tracks onboarding flow position. Added Phase 10.
- onboarding_completed_at DATETIME NULL
  — Set when onboarding completes. Middleware checks this IS NOT NULL before
  — redirecting. Users without onboarding_status set predate onboarding and
  — must never be redirected to /onboarding.
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(email)
- INDEX(is_active)

Rules:
- first_name and last_name required and non-null at DB level
- email required, unique
- password_hash required for core auth
- one account may later link multiple auth providers via auth_methods

---

## 2. auth_methods

Purpose: Future-ready linkage of additional authentication methods to a core user.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- provider ENUM('email','google','facebook','sso_provider') NOT NULL
- provider_user_id VARCHAR(255) NULL
- provider_email VARCHAR(255) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- UNIQUE(provider, provider_user_id)

Rules:
- email provider is primary and always present
- google/facebook are additive; must link to existing users record
- sso_provider used for enterprise SSO (Phase 9 scaffolding; not production-active)

---

## 3. user_2fa_methods

Purpose: Future-ready storage for 2FA enrollment. Schema-ready; feature returns 501.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- method_type ENUM('totp','email_code') NOT NULL
- secret_encrypted TEXT NULL — TOTP secrets encrypted at rest; never plaintext
- is_enabled BOOLEAN NOT NULL DEFAULT FALSE
- last_used_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id, is_enabled)

---

## 4. user_2fa_recovery_codes

Purpose: Future-ready backup codes for 2FA account recovery.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- code_hash VARCHAR(255) NOT NULL — stored hashed, never plaintext
- used_at DATETIME NULL — marks one-time consumption
- created_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- INDEX(used_at)

---

## 5. password_reset_tokens

Purpose: Secure password reset workflow. Custom table; not Laravel's default structure.

Fields:
- email VARCHAR(255) PK
- token_hash VARCHAR(255) NOT NULL — raw token in email only, never stored
- expires_at DATETIME NOT NULL
- created_at DATETIME NOT NULL

Rules:
- tokens expire; store hash not plaintext (see DEC-005)

---

## 6. user_sessions

Purpose: Multi-device audit and session lifecycle tracking alongside Sanctum tokens.
This table is NOT a replacement for Sanctum's personal_access_tokens. Both coexist.
See IDENTITY_AND_AUTH.md for the coexistence explanation.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- session_token_hash VARCHAR(255) NOT NULL — hash of the Sanctum token
- platform ENUM('web','ios','android','unknown') NOT NULL DEFAULT 'unknown'
- device_name VARCHAR(255) NULL
- last_seen_at DATETIME NULL — updated on each authenticated request
- expires_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- INDEX(expires_at)

---

## 7. organizations

Purpose: Root tenant entity.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- name VARCHAR(255) NOT NULL
- slug VARCHAR(255) NOT NULL UNIQUE
- primary_contact_first_name VARCHAR(100) NOT NULL
- primary_contact_last_name VARCHAR(100) NOT NULL
- primary_contact_email VARCHAR(255) NOT NULL
- primary_contact_phone VARCHAR(50) NULL
- status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active'
- logo_url VARCHAR(500) NULL — S3/CloudFront URL. Added Phase 11.
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(slug)
- INDEX(status)

---

## 8. organization_users

Purpose: Explicit membership and role relationship between users and organizations.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- role ENUM('owner','admin','staff','billing_admin') NOT NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, user_id)
  — A user has one role per organization. Role changes update this row.
- INDEX(user_id)
- INDEX(organization_id, is_active)

Rules:
- At least one active owner must exist per organization at all times
- Role is one of the four enum values; conceptual terms (e.g. "organizer") are
  never stored here — see ROLE_MODEL.md

---

## 9. organization_invitations

Purpose: Invitation workflow for adding new members (admin, staff, billing_admin)
to an organization. Owner role is not grantable via invitation.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- invited_email VARCHAR(255) NOT NULL
- invited_role ENUM('admin','staff','billing_admin') NOT NULL
- invited_by_user_id BIGINT UNSIGNED NOT NULL FK → users.id
- invitation_token_hash VARCHAR(255) NOT NULL — raw token in email only
- status ENUM('pending','accepted','declined','expired') NOT NULL DEFAULT 'pending'
- expires_at DATETIME NOT NULL
- responded_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, status)
- INDEX(invited_email)

Rules:
- Only owner or admin may create invitations
- Expired invitations are rejected on acceptance
- Token stored hashed; same security model as leader_invitations (see DEC-013)

---

## 10. subscriptions

Purpose: Track plan enrollment and billing state for tenant feature gating.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- plan_code ENUM('free','starter','pro','enterprise') NOT NULL
- status ENUM('active','trialing','past_due','canceled','expired') NOT NULL
- starts_at DATETIME NOT NULL
- ends_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, status)
- INDEX(plan_code)

Rules:
- participants are never billed
- feature gating enforced via EnforceFeatureGateService against org plan

---

## 11. locations

Purpose: Reusable normalized location records for workshops and sessions.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NULL FK → organizations.id
- name VARCHAR(255) NULL
- address_line_1 VARCHAR(255) NULL
- address_line_2 VARCHAR(255) NULL
- city VARCHAR(100) NULL
- state_or_region VARCHAR(100) NULL
- postal_code VARCHAR(30) NULL
- country VARCHAR(100) NULL
- latitude DECIMAL(10,7) NULL
- longitude DECIMAL(10,7) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)
- INDEX(city, state_or_region)

---

## 12. workshops

Purpose: Core workshop container.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- workshop_type ENUM('session_based','event_based') NOT NULL
- title VARCHAR(255) NOT NULL
- description TEXT NOT NULL
- status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft'
- timezone VARCHAR(100) NOT NULL
  — Required. All session start_at/end_at stored as UTC but represent times in this timezone.
- start_date DATE NOT NULL
- end_date DATE NOT NULL
- join_code VARCHAR(100) NOT NULL
  — System-generated, unique across all workshops.
- default_location_id BIGINT UNSIGNED NULL FK → locations.id
  — Fallback when session.location_id is null.
- public_page_enabled BOOLEAN NOT NULL DEFAULT FALSE
- public_slug VARCHAR(255) NULL UNIQUE
  — Used for public URL routing when public_page_enabled is true.
- header_image_url VARCHAR(500) NULL
  — S3/CloudFront URL. Added Phase 11.
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(join_code)
- UNIQUE(public_slug)
- INDEX(organization_id, status)
- INDEX(workshop_type)
- INDEX(start_date, end_date)

---

## 13. workshop_logistics

Purpose: Hotel and logistics data for a workshop.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL UNIQUE FK → workshops.id
  — One row per workshop.
- hotel_name VARCHAR(255) NULL
- hotel_address VARCHAR(255) NULL
- hotel_phone VARCHAR(50) NULL
- hotel_notes TEXT NULL
- parking_details TEXT NULL
- meeting_room_details TEXT NULL
- meetup_instructions TEXT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

---

## 14. public_pages

Purpose: Extended content for workshop public pages.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL UNIQUE FK → workshops.id
- hero_title VARCHAR(255) NULL
- hero_subtitle TEXT NULL
- body_content LONGTEXT NULL
- is_visible BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Rules:
- active meeting links must not be publicly exposed
- linked 1:1 to a workshop

---

## 15. tracks

Purpose: Optional session grouping for session-based workshops.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL FK → workshops.id
- title VARCHAR(255) NOT NULL
- color VARCHAR(20) NULL — hex color code for UI display (e.g. "#0FA3B1")
- description TEXT NULL
- sort_order INT NOT NULL DEFAULT 0
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(workshop_id, sort_order)

---

## 16. leaders

Purpose: Global reusable leader profile entity. Not scoped to a single organization.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NULL FK → users.id
  — Null until invitation is accepted and account is linked.
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- display_name VARCHAR(255) NULL
- bio TEXT NULL
- profile_image_url VARCHAR(500) NULL
- website_url VARCHAR(500) NULL
- email VARCHAR(255) NULL
- phone_number VARCHAR(50) NULL — private
- address_line_1 VARCHAR(255) NULL — private
- address_line_2 VARCHAR(255) NULL — private
- city VARCHAR(100) NULL — public-safe
- state_or_region VARCHAR(100) NULL — public-safe
- postal_code VARCHAR(30) NULL — private
- country VARCHAR(100) NULL — private
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- INDEX(email)
- INDEX(city, state_or_region)

Rules:
- leader may exist before linked user account (user_id nullable)
- leader profile is reusable across organizations
- public APIs must expose only safe fields (see PERMISSIONS_AND_PRIVACY_MODEL.md)

---

## 17. organization_leaders

Purpose: Associate reusable leaders with organizations.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- leader_id BIGINT UNSIGNED NOT NULL FK → leaders.id
- status ENUM('active','inactive') NOT NULL DEFAULT 'active'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, leader_id)
- INDEX(leader_id)

---

## 18. leader_invitations

Purpose: Invitation and acceptance workflow for leaders.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- workshop_id BIGINT UNSIGNED NULL FK → workshops.id
  — Optional; scopes invitation to a specific workshop.
- leader_id BIGINT UNSIGNED NULL FK → leaders.id
  — Null until accepted and leader record is created/linked.
- invited_email VARCHAR(255) NOT NULL
- invited_first_name VARCHAR(100) NULL
- invited_last_name VARCHAR(100) NULL
- status ENUM('pending','accepted','declined','expired','removed') NOT NULL DEFAULT 'pending'
- invitation_token_hash VARCHAR(255) NOT NULL
  — Raw token in email only; never stored. See DEC-013.
- expires_at DATETIME NOT NULL
- responded_at DATETIME NULL
- created_by_user_id BIGINT UNSIGNED NOT NULL FK → users.id
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, status)
- INDEX(workshop_id)
- INDEX(invited_email)

Rules:
- NO session_id column on this table. Session assignment is post-acceptance. See DEC-014.
- accepted leaders only appear publicly as confirmed
- token stored hashed; same security model as organization_invitations

---

## 19. workshop_leaders

Purpose: Workshop-level leader association for public listing only.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL FK → workshops.id
- leader_id BIGINT UNSIGNED NOT NULL FK → leaders.id
- invitation_id BIGINT UNSIGNED NULL FK → leader_invitations.id
- is_confirmed BOOLEAN NOT NULL DEFAULT FALSE
  — Controls public visibility. Does NOT grant operational access.
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(workshop_id, leader_id)
- INDEX(leader_id, is_confirmed)

Rules:
- only accepted/confirmed leaders shown publicly
- this table does not grant roster, check-in, or messaging access

---

## 20. sessions

Purpose: Session or event-style schedule item within a workshop.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL FK → workshops.id
- track_id BIGINT UNSIGNED NULL FK → tracks.id
- title VARCHAR(255) NOT NULL
- description TEXT NULL
- start_at DATETIME NOT NULL — stored UTC; display in workshop timezone
- end_at DATETIME NOT NULL — stored UTC; display in workshop timezone
- location_id BIGINT UNSIGNED NULL FK → locations.id
  — Overrides workshop.default_location_id when set.
- capacity INT NULL
  — NULL means unlimited. NEVER treat as zero. See DEC-010.
- delivery_type ENUM('in_person','virtual','hybrid') NOT NULL
- virtual_participation_allowed BOOLEAN NOT NULL DEFAULT FALSE
  — Controls whether a hybrid session offers virtual access to participants.
  — When true AND delivery_type = 'hybrid': meeting_url required before publish.
- meeting_platform VARCHAR(100) NULL
- meeting_url VARCHAR(1000) NULL
  — Required before publish when delivery_type = 'virtual'.
  — Required before publish when delivery_type = 'hybrid' AND virtual_participation_allowed = true.
  — NEVER in public endpoints or offline sync packages.
- meeting_instructions TEXT NULL
- meeting_id VARCHAR(255) NULL
- meeting_passcode VARCHAR(255) NULL
- notes TEXT NULL
- is_published BOOLEAN NOT NULL DEFAULT FALSE
- header_image_url VARCHAR(500) NULL — S3/CloudFront URL. Added Phase 11.
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(workshop_id, start_at, end_at)
- INDEX(track_id)
- INDEX(location_id)
- INDEX(is_published)
- INDEX(delivery_type)

Rules:
- NO leader_id FK on this table. Leaders assigned via session_leaders. See DEC-012.
- capacity NULL means unlimited
- start_at must be before end_at

---

## 21. session_leaders

Purpose: Operational assignment of leaders to sessions.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- session_id BIGINT UNSIGNED NOT NULL FK → sessions.id
- leader_id BIGINT UNSIGNED NOT NULL FK → leaders.id
- role_label VARCHAR(100) NULL — e.g. "Lead Instructor", "Assistant"
- assignment_status ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending'
  — Must be 'accepted' for operational access (roster, check-in, messaging).
  — Leaders with status pending or declined have no operational access.
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(session_id, leader_id)
- INDEX(leader_id)

Rules:
- roster access, phone visibility, messaging scope all derived from this assignment
- assignment_status = 'accepted' required for all operational capabilities

---

## 22. registrations

Purpose: Participant registration to a workshop.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL FK → workshops.id
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- registration_status ENUM('registered','canceled','waitlisted') NOT NULL DEFAULT 'registered'
- joined_via_code VARCHAR(100) NULL
- registered_at DATETIME NOT NULL
- canceled_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(workshop_id, user_id)
- INDEX(user_id)
- INDEX(workshop_id, registration_status)

Rules:
- participant must be registered before selecting sessions or checking in
- join-by-code flow creates this row

---

## 23. session_selections

Purpose: Participant session selections for session-based workshops.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- registration_id BIGINT UNSIGNED NOT NULL FK → registrations.id
- session_id BIGINT UNSIGNED NOT NULL FK → sessions.id
- selection_status ENUM('selected','canceled','waitlisted') NOT NULL DEFAULT 'selected'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(registration_id, session_id)
- INDEX(session_id, selection_status)

Rules:
- overlapping sessions not both selectable
- capacity enforced when selection_status = 'selected'
- optional/unused for event-based workshops
- participant who has checked in cannot deselect (CannotDeselectCheckedInSessionException)

---

## 24. attendance_records

Purpose: Attendance state per participant per session.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- session_id BIGINT UNSIGNED NOT NULL FK → sessions.id
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- status ENUM('not_checked_in','checked_in','no_show') NOT NULL DEFAULT 'not_checked_in'
- check_in_method ENUM('self','leader') NULL
- checked_in_at DATETIME NULL
- checked_in_by_user_id BIGINT UNSIGNED NULL FK → users.id
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(session_id, user_id)
- INDEX(user_id)
- INDEX(status)
- INDEX(checked_in_at)

Rules:
- one row per (session_id, user_id)
- leader check-in requires session_leaders.assignment_status = 'accepted'

---

## 25. notification_preferences

Purpose: Per-user messaging channel preferences.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id UNIQUE
- email_enabled BOOLEAN NOT NULL DEFAULT TRUE
- push_enabled BOOLEAN NOT NULL DEFAULT TRUE
- in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE
- workshop_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE
- reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE
- marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(user_id)

Rules:
- transactional emails (verification, reset, invitations) bypass these preferences

---

## 26. notifications

Purpose: Workshop notifications created by organisation members or leaders.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- workshop_id BIGINT UNSIGNED NOT NULL FK → workshops.id
- created_by_user_id BIGINT UNSIGNED NOT NULL FK → users.id
- title VARCHAR(255) NOT NULL
- message TEXT NOT NULL
- notification_type ENUM('informational','urgent','reminder') NOT NULL
- sender_scope ENUM('organizer','leader') NOT NULL
- delivery_scope ENUM('all_participants','leaders','session_participants','custom') NOT NULL
  — 'custom' is reserved and throws CustomDeliveryNotImplementedException (501).
- session_id BIGINT UNSIGNED NULL FK → sessions.id
  — Required for all leader-created notifications.
- sent_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, workshop_id)
- INDEX(session_id)
- INDEX(sender_scope, sent_at)

---

## 27. notification_recipients

Purpose: Resolved recipient list and per-channel delivery state.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- notification_id BIGINT UNSIGNED NOT NULL FK → notifications.id
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- email_status ENUM('pending','sent','failed','skipped') NULL
- push_status ENUM('pending','sent','failed','skipped') NULL
- in_app_status ENUM('pending','delivered','read') NULL
- read_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(notification_id, user_id)
- INDEX(user_id, read_at)

---

## 28. push_tokens

Purpose: Mobile push notification token registry.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- platform ENUM('ios','android') NOT NULL
- push_token VARCHAR(500) NOT NULL UNIQUE
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- last_registered_at DATETIME NOT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(push_token)
- INDEX(user_id, is_active)

---

## 29. files

Purpose: Uploaded asset metadata (images, attachments).

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NULL FK → organizations.id
- uploaded_by_user_id BIGINT UNSIGNED NOT NULL FK → users.id
- storage_key VARCHAR(500) NOT NULL — S3 object key
- original_filename VARCHAR(255) NOT NULL
- mime_type VARCHAR(100) NOT NULL
- size_bytes BIGINT UNSIGNED NOT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)
- INDEX(uploaded_by_user_id)

---

## 30. offline_sync_snapshots

Purpose: SHA-256 version hash per workshop for mobile cache invalidation.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- workshop_id BIGINT UNSIGNED NOT NULL FK → workshops.id
- version_hash VARCHAR(255) NOT NULL — SHA-256 computed by GenerateSyncVersionService
- generated_at DATETIME NOT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(workshop_id, generated_at)

Rules:
- hash includes session_leaders.updated_at to capture leader assignment changes (DEC-020)

---

## 31. offline_action_queue

Purpose: Idempotent replay of offline-submitted actions.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- workshop_id BIGINT UNSIGNED NULL FK → workshops.id
- action_type ENUM('self_check_in','leader_check_in','attendance_override') NOT NULL
- client_action_uuid CHAR(36) NOT NULL UNIQUE — client-generated; idempotency key
- payload_json JSON NOT NULL
- processed_at DATETIME NULL — null until successfully replayed
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(client_action_uuid)
- INDEX(user_id, processed_at)

---

## 32. feature_flags

Purpose: Plan-gated or manually overridden feature toggles per organisation.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- feature_key VARCHAR(100) NOT NULL
- is_enabled BOOLEAN NOT NULL DEFAULT FALSE
- source ENUM('plan_default','manual_override') NOT NULL DEFAULT 'plan_default'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, feature_key)

Rules:
- manual_override requires owner role; always audit logged

---

## 33. audit_logs

Purpose: Operational audit trail for all critical tenant-level actions.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NULL FK → organizations.id
- actor_user_id BIGINT UNSIGNED NULL FK → users.id
- entity_type VARCHAR(100) NOT NULL
- entity_id BIGINT UNSIGNED NULL
- action VARCHAR(100) NOT NULL
- metadata_json JSON NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, created_at)
- INDEX(actor_user_id, created_at)
- INDEX(entity_type, entity_id)

Example action values:
- leader_invitation_sent, leader_invitation_accepted, leader_invitation_declined
- leader_profile_completed, leader_assigned_to_session, leader_removed_from_session
- participant_self_checked_in, leader_checked_in_participant, attendance_override
- participant_marked_no_show
- organizer_added_participant_to_session, organizer_removed_participant_from_session
- workshop_published, workshop_archived, workshop_updated
- organization_member_invited, organization_invitation_accepted
- organization_member_role_changed, organization_member_removed
- organization_ownership_transferred
- session_capacity_reached
- leader_notification_sent, leader_notification_rejected
- feature_flag_manual_override
- auth_provider_linked, two_factor_enabled, two_factor_disabled
- user_registered, email_verified, password_reset_completed

---

## 34. login_events

Purpose: Structured login history for audit and security review.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- user_id BIGINT UNSIGNED NOT NULL FK → users.id
- ip_address VARCHAR(45) NULL
- user_agent VARCHAR(500) NULL
- platform VARCHAR(50) NULL
- outcome ENUM('success','failed','blocked') NOT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(user_id, created_at)
- INDEX(outcome, created_at)

---

## 35. security_events

Purpose: Security-relevant events for organisation-level security monitoring.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NULL FK → organizations.id
- user_id BIGINT UNSIGNED NULL FK → users.id
- event_type VARCHAR(100) NOT NULL
- severity ENUM('low','medium','high','critical') NOT NULL DEFAULT 'low'
- metadata_json JSON NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, created_at)
- INDEX(event_type, created_at)

---

## 36. sso_configurations

Purpose: Enterprise SSO provider configuration per organisation. Phase 9 scaffolding.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- provider ENUM('saml','oidc','google_workspace','azure_ad') NOT NULL
- client_id VARCHAR(255) NULL
- client_secret_encrypted TEXT NULL — encrypted at rest
- metadata_url VARCHAR(500) NULL
- is_active BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, provider)

Rules:
- SSO scaffolding only; not production-active
- client_secret encrypted at rest

---

## 37. api_keys

Purpose: External API access credentials for tenant organisations. Phase 9.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- name VARCHAR(255) NOT NULL — human-readable key name
- secret_hash VARCHAR(255) NOT NULL — raw key issued once at creation; stored hashed
- last_used_at DATETIME NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- expires_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)

---

## 38. webhook_endpoints

Purpose: Outbound webhook targets registered by tenant organisations.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL FK → organizations.id
- url VARCHAR(500) NOT NULL
- events JSON NOT NULL — array of event type strings to subscribe to
- signing_secret_hash VARCHAR(255) NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, is_active)

---

## 39. webhook_deliveries

Purpose: Delivery log for outbound webhook attempts.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- webhook_endpoint_id BIGINT UNSIGNED NOT NULL FK → webhook_endpoints.id
- event_type VARCHAR(100) NOT NULL
- payload_json JSON NOT NULL
- response_status INT NULL
- response_body TEXT NULL
- attempt_count INT NOT NULL DEFAULT 1
- delivered_at DATETIME NULL
- next_retry_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(webhook_endpoint_id, created_at)
- INDEX(event_type)

---

## 40. system_announcements

Purpose: Platform-wide announcements created by platform admins and displayed
to all tenant admin users.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- title VARCHAR(255) NOT NULL
- message TEXT NOT NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- starts_at DATETIME NULL
- ends_at DATETIME NULL
- created_by_admin_user_id BIGINT UNSIGNED NULL FK → admin_users.id
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(is_active, starts_at, ends_at)

---

# Part 2 — Platform Schema (Command Center)

These tables are used exclusively by the Command Center platform admin application.
They are accessed via `auth:platform_admin` guard and routes under `/api/platform/v1/*`.
No tenant token may access these tables directly.

---

## 41. admin_users

Purpose: Platform administrator accounts for Command Center access.
Replaces the deprecated `platform_admins` table (see table 55).

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- email VARCHAR(255) NOT NULL UNIQUE
- password_hash VARCHAR(255) NOT NULL
- role ENUM('super_admin','admin','support','billing','readonly') NOT NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- last_login_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(email)
- INDEX(role, is_active)

Rules:
- completely isolated from users table
- at least one super_admin must always exist

---

## 42. admin_login_events

Purpose: Login audit trail for platform admin accounts.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- admin_user_id BIGINT UNSIGNED NOT NULL FK → admin_users.id
- ip_address VARCHAR(45) NULL
- user_agent VARCHAR(500) NULL
- outcome ENUM('success','failed') NOT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(admin_user_id, created_at)

---

## 43. platform_audit_logs

Purpose: Audit trail for all platform admin mutations of tenant data.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- admin_user_id BIGINT UNSIGNED NULL FK → admin_users.id
- organization_id BIGINT UNSIGNED NULL
  — Not an FK; platform admins can reference any org.
- action VARCHAR(100) NOT NULL
- entity_type VARCHAR(100) NULL
- entity_id BIGINT UNSIGNED NULL
- old_value_json JSON NULL
- new_value_json JSON NULL
- metadata_json JSON NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(admin_user_id, created_at)
- INDEX(organization_id, created_at)

Rules:
- every platform admin mutation writes here; no exceptions

---

## 44. stripe_customers

Purpose: Stripe customer ID mirror for local billing queries.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL UNIQUE
- stripe_customer_id VARCHAR(100) NOT NULL UNIQUE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

---

## 45. stripe_subscriptions

Purpose: Stripe subscription state mirror.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL
- stripe_subscription_id VARCHAR(100) NOT NULL UNIQUE
- stripe_customer_id VARCHAR(100) NOT NULL
- status VARCHAR(50) NOT NULL
- plan_id VARCHAR(100) NOT NULL
- current_period_start DATETIME NULL
- current_period_end DATETIME NULL
- canceled_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)
- INDEX(status)

---

## 46. stripe_invoices

Purpose: Stripe invoice mirror.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL
- stripe_invoice_id VARCHAR(100) NOT NULL UNIQUE
- stripe_customer_id VARCHAR(100) NOT NULL
- amount_due INT NOT NULL — in cents
- amount_paid INT NOT NULL — in cents
- currency VARCHAR(10) NOT NULL DEFAULT 'usd'
- status VARCHAR(50) NOT NULL
- invoice_pdf_url VARCHAR(500) NULL
- period_start DATETIME NULL
- period_end DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)

---

## 47. stripe_events

Purpose: Idempotent Stripe webhook event log.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- stripe_event_id VARCHAR(100) NOT NULL UNIQUE
- event_type VARCHAR(100) NOT NULL
- payload_json JSON NOT NULL
- processed_at DATETIME NULL
- created_at DATETIME NOT NULL

Indexes:
- UNIQUE(stripe_event_id)
- INDEX(event_type)

Rules:
- Stripe webhook handler is not yet implemented (see OPEN_QUESTIONS.md Q4)

---

## 48. automation_rules

Purpose: Configurable automation trigger/action rules per organisation.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NOT NULL
- name VARCHAR(255) NOT NULL
- trigger_event VARCHAR(100) NOT NULL
- trigger_conditions_json JSON NULL
- action_type VARCHAR(100) NOT NULL
- action_config_json JSON NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, is_active)
- INDEX(trigger_event)

Rules:
- automation execution engine not yet implemented (see OPEN_QUESTIONS.md Q8)

---

## 49. automation_runs

Purpose: Execution log for automation rule runs.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- automation_rule_id BIGINT UNSIGNED NOT NULL FK → automation_rules.id
- triggered_at DATETIME NOT NULL
- outcome ENUM('success','failed','skipped') NOT NULL
- error_message TEXT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(automation_rule_id, triggered_at)

---

## 50. support_tickets

Purpose: Customer support ticket tracking.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NULL
- user_id BIGINT UNSIGNED NULL
- subject VARCHAR(255) NOT NULL
- status ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open'
- priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)
- INDEX(status, priority)

---

## 51. support_ticket_messages

Purpose: Messages on support tickets.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- support_ticket_id BIGINT UNSIGNED NOT NULL FK → support_tickets.id
- sender_type ENUM('user','admin') NOT NULL
- sender_id BIGINT UNSIGNED NOT NULL
  — References users.id when sender_type = 'user';
  — References admin_users.id when sender_type = 'admin'.
- message TEXT NOT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(support_ticket_id, created_at)

---

## 52. help_articles

Purpose: Platform help and documentation articles.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- title VARCHAR(255) NOT NULL
- slug VARCHAR(255) NOT NULL UNIQUE
- content LONGTEXT NOT NULL
- is_published BOOLEAN NOT NULL DEFAULT FALSE
- created_by_admin_user_id BIGINT UNSIGNED NULL FK → admin_users.id
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(slug)
- INDEX(is_published)

---

## 53. platform_config

Purpose: Key-value platform-level configuration store.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- config_key VARCHAR(100) NOT NULL UNIQUE
- config_value TEXT NULL
- description VARCHAR(255) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

---

## 54. metric_snapshots

Purpose: Periodic platform-level and tenant-level metric snapshots.

Fields:
- id BIGINT UNSIGNED PK AUTO_INCREMENT
- organization_id BIGINT UNSIGNED NULL — null for platform-level metrics
- snapshot_date DATE NOT NULL
- metrics_json JSON NOT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, snapshot_date)
- INDEX(snapshot_date)

---

## 55. platform_admins [DEPRECATED]

**⚠️ DEPRECATED — Do not use. Do not reference in new code.**

This table was created and subsequently replaced by `admin_users` (Table 41).
The migration has not been rolled back. A down migration should be written to drop
this table (see PHASE_STATUS.md Audit Remediation item AR-10).

Original purpose: Platform administrator accounts.
Replaced by: Table 41 `admin_users`

---

# Relationship Summary

**Tenant identity and access:**
- users ↔ organizations through organization_users (role-bearing)
- users ↔ organizations through organization_invitations (invitation flow)

**Workshop domain:**
- organizations → workshops → sessions, tracks, workshop_logistics
- workshops → public_pages (1:1)

**Leaders:**
- leaders ↔ organizations through organization_leaders
- workshops ↔ leaders through workshop_leaders (public listing only)
- sessions ↔ leaders through session_leaders (operational access; assignment_status required)

**Participant workflows:**
- workshops ↔ users through registrations
- registrations ↔ sessions through session_selections
- sessions ↔ users through attendance_records

**Notifications:**
- notifications link org/workshop/session/sender to recipient users
- notification_recipients tracks per-channel delivery state

**Offline sync:**
- offline_sync_snapshots: SHA-256 version hash per workshop
- offline_action_queue: idempotent replay via client_action_uuid

**Audit:**
- audit_logs: tenant-level operational audit trail
- login_events: structured login history
- platform_audit_logs: platform admin mutation trail

---

# Privacy Rules Mapped to Schema

1. **Participant phone numbers** (`users.phone_number`, visible in roster context):
   Controlled by role. Visible to: assigned leaders (assignment_status = accepted),
   org owner/admin/staff. Never public, never to billing_admin.

2. **Leader address privacy**: `leaders.address_line_1`, `address_line_2`, `postal_code`,
   `country` are private. Public APIs expose only `city`, `state_or_region`.

3. **Leader public-safe fields**: `first_name`, `last_name`, `display_name`, `bio`,
   `profile_image_url`, `website_url`, `city`, `state_or_region`.

4. **Meeting URL privacy**: `sessions.meeting_url`, `meeting_id`, `meeting_passcode`
   are never in public endpoints or offline sync packages. See DEC-021.

5. **Leader messaging enforcement**: `notifications.sender_scope = 'leader'` requires
   `session_id`, targets session participants only, enforced within time window.
   All leader notifications write to `audit_logs`.

---

# Non-Negotiable Validation Rules

- first_name and last_name are required and non-null for all real people
- email/password is core auth; social auth is additive
- 2FA schema-ready; feature not active
- capacity = NULL is unlimited; never treated as zero
- session publish blocked when virtual/hybrid meeting requirements unmet
- leader public confirmation requires accepted invitation
- leader messaging constrained by session assignment, time window, plan gate
- private data must not leak in public or unrelated role surfaces
- billing_admin has no access to workshops, sessions, participants, or reports