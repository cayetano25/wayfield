# Identity and Authentication Specification

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
This file is the domain spec source of truth for identity and authentication.

## Implementation note on auth token mechanism
The authoritative implementation choice is **Laravel Sanctum** for API token management.
Sanctum manages its own `personal_access_tokens` table for token lifecycle.
The `user_sessions` table in `DATA_SCHEMA_FULL.md` (Table 6) serves as an
**audit and lifecycle record** for tracking platform, device, and last-seen metadata —
it is not a replacement for Sanctum's token table. Both coexist:
- Sanctum handles token issuance, validation, and revocation.
- `user_sessions` records session context (platform, device, last seen) for audit and
  multi-device management UI purposes.

---

## Core Identity Rules

1. Primary authentication method:
   - email (unique, required)
   - password (hashed, required)

2. Authentication must function identically across:
   - web application
   - mobile application

3. Email verification is required before full system access is granted.

4. Password reset must be supported via secure token-based flow.

---

## User Entity Requirements

All user records MUST include:

- id (primary key)
- first_name (required, non-null)
- last_name (required, non-null)
- email (required, unique)
- password_hash (required)
- email_verified_at (nullable)
- created_at
- updated_at

Constraints:
- display_name must NOT replace first_name/last_name
- first_name/last_name required at DB and API validation levels

---

## Authentication Methods Model

A user may have multiple authentication methods.

Table: auth_methods (see DATA_SCHEMA_FULL.md Table 2)

Fields:
- id
- user_id (FK)
- provider (enum: email, google, facebook)
- provider_user_id (nullable for email)
- provider_email (nullable)
- created_at
- updated_at

Rules:
- email provider is primary and always present
- social providers are linked identities, additive only
- user may have multiple providers
- social login must link to existing user record, not create a parallel account
- if a social login email matches an existing account, conflict resolution is required

---

## Social Login Readiness

Schema must support future linkage for:
- Google
- Facebook

Rules:
- Social login must NOT replace core email/password account
- Social accounts must link to existing user record
- Conflict resolution required if email already exists
- Implementation of active social login is a Phase 3 feature (see MVP_SCOPE.md)

---

## Two-Factor Authentication (2FA)

Schema must support (tables defined in DATA_SCHEMA_FULL.md, Tables 3 and 4):

Table: user_2fa_methods
- user_id
- method_type (enum: totp, email_code)
- secret_encrypted (TOTP secrets must be encrypted at rest)
- is_enabled (boolean, default false)
- last_used_at (nullable)

Table: user_2fa_recovery_codes
- id
- user_id
- code_hash (stored hashed, never plaintext)
- used_at (nullable — marks one-time consumption)

Supported methods (future activation):
- TOTP (authenticator apps)
- Email-based one-time codes (future)
- Recovery codes

Active 2FA implementation is a Phase 3 feature (see MVP_SCOPE.md).
Tables must exist and be schema-ready from Phase 1.

---

## Session Management (Sanctum + user_sessions)

Sanctum manages:
- Token issuance on login
- Token validation on each request
- Token revocation on logout
- Platform tagging via `platform` field in token request

user_sessions table (DATA_SCHEMA_FULL.md Table 6) records:
- session_token_hash (hash of the Sanctum token for cross-reference)
- platform (enum: web, ios, android, unknown)
- device_name (nullable)
- last_seen_at (updated on each authenticated request)
- expires_at (nullable)

Rules:
- Tokens must be cryptographically secure (Sanctum handles this)
- Sessions must support per-device invalidation
- Mobile tokens must support refresh — expiry durations are an open question
  (see README.md Open Issues)

---

## Security Requirements

- Passwords must be hashed using bcrypt or Argon2 (Laravel default: bcrypt)
- Sanctum tokens are cryptographically secure random strings
- Email verification tokens must expire (duration TBD — see README.md Open Issues)
- Password reset tokens must expire (duration TBD — see README.md Open Issues)
- Invitation tokens must be stored hashed in DB; raw token sent in email link only
  (see leader_invitations.invitation_token_hash in DATA_SCHEMA_FULL.md Table 16)

---

## Identity Constraints

- A user must always have first_name, last_name, email
- No anonymous accounts
- No shared accounts
- No display_name-only records

---

## Audit Requirements

The following must be logged to audit_logs:

- user registration
- email verification completed
- password reset requested
- password reset completed
- auth provider linked (google, facebook)
- 2FA enabled
- 2FA disabled
