# Full Data Schema Specification

## Source Authority
This file is the **schema source of truth** (Tier 3 in the hierarchy).
Field names, types, and table structure defined here override all domain spec files.
Constitutional authority: `MASTER_PROMPT.md`

## SCHEMA_SPEC.md notes absorbed
The notifications table (Table 24) and audit_logs table (Table 32) notes from the
retired SCHEMA_SPEC.md have been verified as identical and are already present below.

---



## Purpose
Define the production-oriented relational schema for Wayfield, including identity, multi-tenant organization structure, workshop domain, session scheduling, leader workflows, attendance, notifications, audit logging, and future-ready authentication extensions.

This schema is intended for implementation in MySQL and aligned with:
- primary email/password authentication
- future Google/Facebook auth linkage
- future 2FA
- multi-tenant organization ownership
- session-based and event-based workshop support
- leader invitation and self-managed profile ownership
- participant self-check-in
- constrained leader messaging
- subscription-aware feature gating
- auditability of operational events

---

## Schema Design Principles

1. All real people are modeled with:
   - first_name
   - last_name

2. Multi-tenant scoping is explicit and enforced.

3. Privacy-sensitive data is stored separately or handled with least-privilege access patterns.

4. Future auth and enterprise enhancements are modeled now, even if not immediately enabled.

5. Capacity, permissions, and messaging constraints must be enforced by backend business logic, not only UI.

---

## 1. users

Purpose:
Canonical account entity for shared identity across mobile and web.

Fields:
- id BIGINT UNSIGNED PK
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- email VARCHAR(255) NOT NULL UNIQUE
- password_hash VARCHAR(255) NOT NULL
- email_verified_at DATETIME NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- last_login_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(email)
- INDEX(is_active)

Rules:
- first_name and last_name required
- email required and unique
- password_hash required for core auth
- one account can later link multiple auth providers

---

## 2. auth_methods

Purpose:
Future-ready linkage of additional authentication methods to a core user.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- provider ENUM('email','google','facebook') NOT NULL
- provider_user_id VARCHAR(255) NULL
- provider_email VARCHAR(255) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- UNIQUE(provider, provider_user_id)

Rules:
- email provider record may represent native auth
- google/facebook are additive conduits
- social auth must link to existing user account model, not replace it

---

## 3. user_2fa_methods

Purpose:
Future-ready storage for 2FA enrollment.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- method_type ENUM('totp','email_code') NOT NULL
- secret_encrypted TEXT NULL
- is_enabled BOOLEAN NOT NULL DEFAULT FALSE
- last_used_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id, is_enabled)

Rules:
- TOTP secrets must be encrypted at rest
- email_code support may be enabled later
- this table scaffolds future hardening phases

---

## 4. user_2fa_recovery_codes

Purpose:
Future-ready backup codes for account recovery.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- code_hash VARCHAR(255) NOT NULL
- used_at DATETIME NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- INDEX(used_at)

Rules:
- codes stored hashed, never plaintext
- used_at marks one-time consumption

---

## 5. password_reset_tokens

Purpose:
Password reset workflow.

Fields:
- email VARCHAR(255) PK
- token_hash VARCHAR(255) NOT NULL
- expires_at DATETIME NOT NULL
- created_at DATETIME NOT NULL

Rules:
- tokens expire
- store hash, not plaintext token

---

## 6. user_sessions

Purpose:
Track authenticated sessions for web/mobile token lifecycle if needed.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- session_token_hash VARCHAR(255) NOT NULL
- platform ENUM('web','ios','android','unknown') NOT NULL DEFAULT 'unknown'
- device_name VARCHAR(255) NULL
- last_seen_at DATETIME NULL
- expires_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- INDEX(expires_at)

---

## 7. organizations

Purpose:
Root tenant entity.

Fields:
- id BIGINT UNSIGNED PK
- name VARCHAR(255) NOT NULL
- slug VARCHAR(255) NOT NULL UNIQUE
- primary_contact_first_name VARCHAR(100) NOT NULL
- primary_contact_last_name VARCHAR(100) NOT NULL
- primary_contact_email VARCHAR(255) NOT NULL
- primary_contact_phone VARCHAR(50) NULL
- status ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(slug)
- INDEX(status)

Rules:
- organizations must support explicit contact modeling
- organization is tenant boundary root

---

## 8. organization_users

Purpose:
Explicit many-to-many relationship between users and organizations with role distinctions.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- role ENUM('owner','admin','staff','billing_admin') NOT NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, user_id, role)
- INDEX(user_id)
- INDEX(organization_id, is_active)

Rules:
- organizations may have multiple managers
- do not collapse management into a single owner field
- role-aware authorization required

---

## 9. subscriptions

Purpose:
Track plan enrollment and billing state for tenant feature gating.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
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
- feature gating enforced against org plan

---

## 10. locations

Purpose:
Reusable normalized location records for workshops and sessions.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NULL FK -> organizations.id
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

Rules:
- workshop may define a default location
- session may override workshop location

---

## 11. workshops

Purpose:
Core workshop container.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
- workshop_type ENUM('session_based','event_based') NOT NULL
- title VARCHAR(255) NOT NULL
- description TEXT NOT NULL
- status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft'
- timezone VARCHAR(100) NOT NULL
- start_date DATE NOT NULL
- end_date DATE NOT NULL
- join_code VARCHAR(100) NOT NULL
- default_location_id BIGINT UNSIGNED NULL FK -> locations.id
- public_page_enabled BOOLEAN NOT NULL DEFAULT FALSE
- public_slug VARCHAR(255) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(join_code)
- UNIQUE(public_slug)
- INDEX(organization_id, status)
- INDEX(workshop_type)
- INDEX(start_date, end_date)

Rules:
- every workshop belongs to an organization
- supports session-based and event-based modes
- public page may be enabled separately
- join_code required
- timezone required

---

## 12. workshop_logistics

Purpose:
Hotel and logistics data associated with workshop overview.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL UNIQUE FK -> workshops.id
- hotel_name VARCHAR(255) NULL
- hotel_address VARCHAR(255) NULL
- hotel_phone VARCHAR(50) NULL
- hotel_notes TEXT NULL
- parking_details TEXT NULL
- meeting_room_details TEXT NULL
- meetup_instructions TEXT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Rules:
- one row per workshop
- visible in participant overview and public page where appropriate

---

## 13. tracks

Purpose:
Optional grouping for session-based workshops.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL FK -> workshops.id
- title VARCHAR(255) NOT NULL
- description TEXT NULL
- sort_order INT NOT NULL DEFAULT 0
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(workshop_id, sort_order)

Rules:
- optional
- mainly relevant to session-based workshops

---

## 14. leaders

Purpose:
Global reusable leader profile entity.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NULL FK -> users.id
- first_name VARCHAR(100) NOT NULL
- last_name VARCHAR(100) NOT NULL
- display_name VARCHAR(255) NULL
- bio TEXT NULL
- profile_image_url VARCHAR(500) NULL
- website_url VARCHAR(500) NULL
- email VARCHAR(255) NULL
- phone_number VARCHAR(50) NULL
- address_line_1 VARCHAR(255) NULL
- address_line_2 VARCHAR(255) NULL
- city VARCHAR(100) NULL
- state_or_region VARCHAR(100) NULL
- postal_code VARCHAR(30) NULL
- country VARCHAR(100) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(user_id)
- INDEX(email)
- INDEX(city, state_or_region)

Rules:
- leader may exist before linked user account is completed
- leader profile is reusable across organizations
- public views must expose only safe fields

---

## 15. organization_leaders

Purpose:
Associate reusable leaders with organizations.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
- leader_id BIGINT UNSIGNED NOT NULL FK -> leaders.id
- status ENUM('active','inactive') NOT NULL DEFAULT 'active'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, leader_id)
- INDEX(leader_id)

Rules:
- leaders may belong to multiple organizations

---

## 16. leader_invitations

Purpose:
Invitation and acceptance workflow for leaders.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
- workshop_id BIGINT UNSIGNED NULL FK -> workshops.id
- leader_id BIGINT UNSIGNED NULL FK -> leaders.id
- invited_email VARCHAR(255) NOT NULL
- invited_first_name VARCHAR(100) NULL
- invited_last_name VARCHAR(100) NULL
- status ENUM('pending','accepted','declined','expired','removed') NOT NULL DEFAULT 'pending'
- invitation_token_hash VARCHAR(255) NOT NULL
- expires_at DATETIME NOT NULL
- responded_at DATETIME NULL
- created_by_user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, status)
- INDEX(workshop_id)
- INDEX(invited_email)

Rules:
- accepted leaders only appear publicly as confirmed
- organizer should not be forced to fully populate leader profile
- supports placeholder records and later profile completion

---

## 17. workshop_leaders

Purpose:
Optional workshop-level association for display or general participation.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL FK -> workshops.id
- leader_id BIGINT UNSIGNED NOT NULL FK -> leaders.id
- invitation_id BIGINT UNSIGNED NULL FK -> leader_invitations.id
- is_confirmed BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(workshop_id, leader_id)
- INDEX(leader_id, is_confirmed)

Rules:
- only accepted/confirmed leaders should be publicly shown as confirmed

---

## 18. sessions

Purpose:
Session or event-style schedule item.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL FK -> workshops.id
- track_id BIGINT UNSIGNED NULL FK -> tracks.id
- title VARCHAR(255) NOT NULL
- description TEXT NULL
- start_at DATETIME NOT NULL
- end_at DATETIME NOT NULL
- location_id BIGINT UNSIGNED NULL FK -> locations.id
- capacity INT NULL
- delivery_type ENUM('in_person','virtual','hybrid') NOT NULL
- meeting_platform VARCHAR(100) NULL
- meeting_url VARCHAR(1000) NULL
- meeting_instructions TEXT NULL
- meeting_id VARCHAR(255) NULL
- meeting_passcode VARCHAR(255) NULL
- notes TEXT NULL
- is_published BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(workshop_id, start_at, end_at)
- INDEX(track_id)
- INDEX(location_id)
- INDEX(is_published)
- INDEX(delivery_type)

Rules:
- capacity NULL means unlimited
- if delivery_type is virtual or hybrid with participant virtual access, meeting_url required before publish
- session may override workshop location
- start_at must be before end_at

---

## 19. session_leaders

Purpose:
Support one or more leaders assigned to specific sessions.

Fields:
- id BIGINT UNSIGNED PK
- session_id BIGINT UNSIGNED NOT NULL FK -> sessions.id
- leader_id BIGINT UNSIGNED NOT NULL FK -> leaders.id
- role_label VARCHAR(100) NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(session_id, leader_id)
- INDEX(leader_id)

Rules:
- roster and messaging scope derive from session assignment
- leader must not access unassigned sessions

---

## 20. registrations

Purpose:
Participant registration to a workshop.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL FK -> workshops.id
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
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
- join-by-code flow should map here

---

## 21. session_selections

Purpose:
Participant selections for session-based workshops.

Fields:
- id BIGINT UNSIGNED PK
- registration_id BIGINT UNSIGNED NOT NULL FK -> registrations.id
- session_id BIGINT UNSIGNED NOT NULL FK -> sessions.id
- selection_status ENUM('selected','canceled','waitlisted') NOT NULL DEFAULT 'selected'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(registration_id, session_id)
- INDEX(session_id, selection_status)

Rules:
- overlapping sessions should not both be selectable unless future policy says otherwise
- capacity enforced when selection_status becomes selected
- may be optional or unused for event-based workshops

---

## 22. attendance_records

Purpose:
Track attendance state by participant and session.

Fields:
- id BIGINT UNSIGNED PK
- session_id BIGINT UNSIGNED NOT NULL FK -> sessions.id
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- status ENUM('not_checked_in','checked_in','no_show') NOT NULL DEFAULT 'not_checked_in'
- check_in_method ENUM('self','leader') NULL
- checked_in_at DATETIME NULL
- checked_in_by_user_id BIGINT UNSIGNED NULL FK -> users.id
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(session_id, user_id)
- INDEX(user_id)
- INDEX(status)
- INDEX(checked_in_at)

Rules:
- one attendance row per user per session
- participant self-check-in supported
- leader manual override supported
- no-show marking supported
- only assigned leaders and organizers can operationally manage attendance

---

## 23. notification_preferences

Purpose:
Future-ready user preference model for messaging channels.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- email_enabled BOOLEAN NOT NULL DEFAULT TRUE
- push_enabled BOOLEAN NOT NULL DEFAULT TRUE
- workshop_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE
- reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE
- marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(user_id)

---

## 24. notifications

Purpose:
Workshop notifications created by organizers or allowed leader flows.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
- workshop_id BIGINT UNSIGNED NOT NULL FK -> workshops.id
- created_by_user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- title VARCHAR(255) NOT NULL
- message TEXT NOT NULL
- notification_type ENUM('informational','urgent','reminder') NOT NULL
- sender_scope ENUM('organizer','leader') NOT NULL
- delivery_scope ENUM('all_participants','leaders','custom','session_participants') NOT NULL
- session_id BIGINT UNSIGNED NULL FK -> sessions.id
- sent_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, workshop_id)
- INDEX(session_id)
- INDEX(sender_scope, sent_at)

Rules:
- leader-created notifications must include session_id
- leader-created notifications must target session participants only
- organizer notifications may have broader scopes depending on permissions

---

## 25. notification_recipients

Purpose:
Resolve exact user recipients for a notification and delivery state.

Fields:
- id BIGINT UNSIGNED PK
- notification_id BIGINT UNSIGNED NOT NULL FK -> notifications.id
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- email_status ENUM('pending','sent','failed','skipped') NULL
- push_status ENUM('pending','sent','failed','skipped') NULL
- in_app_status ENUM('pending','delivered','read') NULL
- read_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(notification_id, user_id)
- INDEX(user_id, read_at)

Rules:
- supports auditability and channel-specific retries

---

## 26. push_tokens

Purpose:
Mobile push token registry.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- platform ENUM('ios','android') NOT NULL
- push_token VARCHAR(500) NOT NULL
- is_active BOOLEAN NOT NULL DEFAULT TRUE
- last_registered_at DATETIME NOT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(push_token)
- INDEX(user_id, is_active)

---

## 27. public_pages

Purpose:
Future-proof public presentation settings for workshop pages.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL UNIQUE FK -> workshops.id
- hero_title VARCHAR(255) NULL
- hero_subtitle TEXT NULL
- body_content LONGTEXT NULL
- is_visible BOOLEAN NOT NULL DEFAULT FALSE
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Rules:
- active meeting links should not be publicly exposed by default

---

## 28. files

Purpose:
Reference uploaded assets such as leader profile images or workshop attachments.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NULL FK -> organizations.id
- uploaded_by_user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- storage_key VARCHAR(500) NOT NULL
- original_filename VARCHAR(255) NOT NULL
- mime_type VARCHAR(100) NOT NULL
- size_bytes BIGINT UNSIGNED NOT NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id)
- INDEX(uploaded_by_user_id)

---

## 29. offline_sync_snapshots

Purpose:
Track mobile sync versions for workshop data packages.

Fields:
- id BIGINT UNSIGNED PK
- workshop_id BIGINT UNSIGNED NOT NULL FK -> workshops.id
- version_hash VARCHAR(255) NOT NULL
- generated_at DATETIME NOT NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(workshop_id, generated_at)

Rules:
- supports offline-first mobile cache invalidation

---

## 30. offline_action_queue

Purpose:
Optional server-side tracking or reconciliation of offline-submitted actions.

Fields:
- id BIGINT UNSIGNED PK
- user_id BIGINT UNSIGNED NOT NULL FK -> users.id
- workshop_id BIGINT UNSIGNED NULL FK -> workshops.id
- action_type ENUM('self_check_in','leader_check_in','attendance_override') NOT NULL
- client_action_uuid CHAR(36) NOT NULL
- payload_json JSON NOT NULL
- processed_at DATETIME NULL
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(client_action_uuid)
- INDEX(user_id, processed_at)

Rules:
- useful for idempotent replay and reconciliation

---

## 31. feature_flags

Purpose:
Track explicit plan-gated or manually enabled features at tenant level if needed.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NOT NULL FK -> organizations.id
- feature_key VARCHAR(100) NOT NULL
- is_enabled BOOLEAN NOT NULL DEFAULT FALSE
- source ENUM('plan','manual_override') NOT NULL DEFAULT 'plan'
- created_at DATETIME NOT NULL
- updated_at DATETIME NOT NULL

Indexes:
- UNIQUE(organization_id, feature_key)

---

## 32. audit_logs

Purpose:
Record important operational actions.

Fields:
- id BIGINT UNSIGNED PK
- organization_id BIGINT UNSIGNED NULL FK -> organizations.id
- actor_user_id BIGINT UNSIGNED NULL FK -> users.id
- entity_type VARCHAR(100) NOT NULL
- entity_id BIGINT UNSIGNED NULL
- action VARCHAR(100) NOT NULL
- metadata_json JSON NULL
- created_at DATETIME NOT NULL

Indexes:
- INDEX(organization_id, created_at)
- INDEX(actor_user_id, created_at)
- INDEX(entity_type, entity_id)

Examples:
- leader invitation sent
- leader accepted invitation
- leader profile completed
- participant manually checked in by leader
- workshop published
- organization contact changed
- organization manager added or removed
- session capacity reached
- external auth provider linked
- 2FA enabled or disabled
- leader notification sent

---

## Derived Access/Privacy Rules Mapped to Schema

1. Participant phone number visibility
- user phone may be stored in a user profile extension later if needed
- exposure controlled by session assignment and organizer role
- never public

2. Leader address privacy
- address fields stored on leaders
- public APIs must exclude them

3. Leader public safe fields
- first_name
- last_name
- display_name if used
- bio snippet
- website_url
- profile_image_url
- city
- state_or_region

4. Leader messaging enforcement
- notifications.sender_scope = leader
- notifications.session_id required
- recipients resolved only from assigned session participants
- audit_logs required

---

## Core Relationship Summary

- users ↔ organizations through organization_users
- organizations → workshops
- workshops → sessions, tracks, workshop_logistics
- leaders ↔ organizations through organization_leaders
- workshops ↔ leaders through workshop_leaders
- sessions ↔ leaders through session_leaders
- workshops ↔ users through registrations
- registrations ↔ sessions through session_selections
- attendance_records link users to sessions operationally
- notifications link org/workshop/session communication to recipients
- audit_logs capture traceability across all critical domains

---

## Non-Negotiable Validation Rules

- first_name and last_name required for real people
- email/password is core auth
- social auth is additive
- 2FA is future-ready
- capacity enforced when not null
- session publish blocked when virtual/hybrid meeting requirements are unmet
- leader public confirmation requires accepted invitation
- leader messaging constrained by session assignment and time window
- private data must not leak in public or unrelated role surfaces