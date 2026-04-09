# Identity and Authentication Specification
## docs/02_domain/IDENTITY_AND_AUTH.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
This file is the domain spec source of truth for identity and authentication.
The canonical schema is `docs/03_schema/DATA_SCHEMA_FULL.md`.

---

## Implementation Note on Auth Token Mechanism

The authoritative implementation choice is **Laravel Sanctum** for API token management.
Sanctum manages its own `personal_access_tokens` table for token lifecycle.

The `user_sessions` table (see Section 6) serves as an **audit and lifecycle record**
for tracking platform, device, and last-seen metadata — it is not a replacement for
Sanctum's token table. Both coexist with distinct purposes:

- **Sanctum** handles token issuance, validation, and revocation.
- **`user_sessions`** records session context (platform, device, last seen) for audit
  and multi-device management UI purposes.

On login, both a Sanctum token and a `user_sessions` row are created together.
The `user_sessions.session_token_hash` is a hash of the Sanctum token for cross-reference.

---

## 1. Core Identity Rules

1. Primary authentication method:
   - email address (unique, required)
   - password (hashed, required — stored as `password_hash`, not `password`)

2. Authentication must function identically across:
   - web application
   - mobile application

3. Email verification is required before full system access is granted.

4. Password reset must be supported via a secure, token-based flow.

5. One user account serves all roles. The `users` table is the single identity
   record for every person in the tenant system — participant, leader, and organisation
   member. Role is derived from relationships, not from any field on `users`.
   See `docs/02_domain/UNIFIED_USER_ACCOUNT.md` and `docs/02_domain/ROLE_MODEL.md`.

---

## 2. User Entity

All user records MUST include the following fields. The canonical field list and
types are in `docs/03_schema/DATA_SCHEMA_FULL.md` Table 1; this section is the
domain-level requirement statement.

**Required:**
- `id` — primary key
- `first_name` — required, non-null
- `last_name` — required, non-null
- `email` — required, unique
- `password_hash` — required (column name is `password_hash`, not `password`)
- `email_verified_at` — nullable DATETIME; null means unverified
- `is_active` — boolean, default true
- `last_login_at` — nullable DATETIME
- `created_at`, `updated_at`

**Added during Phase 5:**
- `phone_number` — nullable VARCHAR; subject to the same visibility rules as
  participant phone numbers in rosters (visible to assigned leaders, `owner`,
  `admin`, `staff`; never public)

**Added during onboarding implementation (Improvement Phase 10):**
- `onboarding_status` — nullable ENUM; tracks where in the onboarding flow the
  user is. Values defined in the onboarding implementation.
- `onboarding_completed_at` — nullable DATETIME; set when onboarding is completed.
  The onboarding middleware must check `onboarding_intent IS NOT NULL` before
  redirecting — users without intent set predate the onboarding system and must
  never be redirected.

**Added during image upload implementation (Improvement Phase 11):**
- `profile_image_url` — nullable VARCHAR; S3/CloudFront URL of the user's profile picture.

**Constraints:**
- `display_name` must NOT replace `first_name`/`last_name`.
- `first_name` and `last_name` are required at both DB level (NOT NULL) and API
  validation level (Form Request).
- No anonymous accounts. No shared accounts.

---

## 3. Authentication Methods Model

A user may have multiple authentication methods. This supports the additive social
login model and future enterprise SSO.

**Table: `auth_methods`**

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → users | |
| `provider` | ENUM | `email`, `google`, `facebook`, `sso_provider` |
| `provider_user_id` | VARCHAR nullable | null for email provider |
| `provider_email` | VARCHAR nullable | email from the external provider |
| `created_at`, `updated_at` | DATETIME | |

**Rules:**
- `email` provider is primary and always present for every user.
- `google` and `facebook` are additive linked identities — they must link to an
  existing `users` record; they do not create a parallel account.
- If a social login email matches an existing Wayfield account, conflict resolution
  is required before linking.
- `sso_provider` is used for enterprise SSO (Phase 9 scaffolding; not production-ready).
- A user may have multiple `auth_methods` rows over time.

---

## 4. Social Login Readiness

Schema supports future linkage for Google and Facebook.

**Rules:**
- Social login must NOT replace core email/password account.
- Social accounts must link to an existing `users` record.
- Conflict resolution is required if the social login email already belongs to an
  existing Wayfield account.
- Active social login implementation is a Phase 3 product feature (see
  `docs/01_product/MVP_SCOPE.md`). Schema is ready; feature is not wired.

---

## 5. Two-Factor Authentication (2FA)

Schema must exist and be ready even though the feature is not yet active.
`TwoFactorController` endpoints return HTTP 501 Not Implemented.

**Table: `user_2fa_methods`**

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → users | |
| `method_type` | ENUM | `totp`, `email_code` |
| `secret_encrypted` | TEXT nullable | TOTP secret; must be encrypted at rest |
| `is_enabled` | BOOLEAN | default false |
| `last_used_at` | DATETIME nullable | |
| `created_at`, `updated_at` | DATETIME | |

**Table: `user_2fa_recovery_codes`**

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → users | |
| `code_hash` | VARCHAR | stored hashed, never plaintext |
| `used_at` | DATETIME nullable | marks one-time consumption |
| `created_at` | DATETIME | |

**Supported methods (future activation):**
- TOTP (authenticator apps)
- Email-based one-time codes (future)
- Backup/recovery codes

**Implementation notes:**
- TOTP secrets must be encrypted at rest. Never store plaintext secrets.
- Recovery codes are hashed before storage. `used_at` marks single-use consumption.
- Activating 2FA requires no schema changes — only `TwoFactorController` implementation.
- Active 2FA is a Phase 3 feature.

---

## 6. Session Management

Two mechanisms coexist for different purposes.

### 6.1 Sanctum Tokens (`personal_access_tokens`)

Managed entirely by Laravel Sanctum. Do not interact with this table directly.

- Created on login via `LoginUserAction`
- Validated on every authenticated request by `auth:sanctum` middleware
- Revoked on logout via `LogoutAction`
- Support platform tagging via the `platform` field passed during token creation

### 6.2 User Sessions Audit Table (`user_sessions`)

Provides device and multi-session tracking for audit and UI purposes.
Created alongside the Sanctum token at login.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → users | |
| `session_token_hash` | VARCHAR | hash of the Sanctum token for cross-reference |
| `platform` | ENUM | `web`, `ios`, `android`, `unknown` |
| `device_name` | VARCHAR nullable | |
| `last_seen_at` | DATETIME nullable | updated on each authenticated request |
| `expires_at` | DATETIME nullable | |
| `created_at`, `updated_at` | DATETIME | |

**Rules:**
- `session_token_hash` is a hash of the associated Sanctum token — never the raw token.
- `last_seen_at` is updated on each authenticated request for activity tracking.
- Per-device session invalidation is supported.
- Mobile token expiry duration is an open question (see
  `docs/stabilization/OPEN_QUESTIONS.md`).

---

## 7. Password Reset

**Table: `password_reset_tokens`** (custom — not Laravel's default structure)

| Field | Type | Notes |
|---|---|---|
| `email` | VARCHAR PK | |
| `token_hash` | VARCHAR | hashed; raw token sent in email only |
| `expires_at` | DATETIME | |
| `created_at` | DATETIME | |

**Why custom:** Stores a hashed token rather than a plain token, aligning with the
security principle of never storing raw secrets. Laravel's built-in password broker
assumes the default table structure; the reset flow is fully custom
(`RequestPasswordResetAction`, `ResetPasswordAction`). See DEC-005.

---

## 8. Security Requirements

- Passwords are hashed using bcrypt (Laravel default). Argon2 is acceptable.
- Sanctum tokens are cryptographically secure random strings.
- Email verification tokens must expire. Duration: TBD (see OPEN_QUESTIONS.md).
- Password reset tokens must expire. Duration: TBD (see OPEN_QUESTIONS.md).
- Invitation tokens (both leader and organisation member) are stored as hashes in
  the database. The raw token travels only in the invitation email link. See DEC-013.
- TOTP secrets must be encrypted at rest before storage.
- Recovery codes are stored hashed. Never store plaintext codes.

---

## 9. Audit Requirements

The following must be logged to `audit_logs`:

- user registration
- email verification completed
- password reset requested
- password reset completed
- auth provider linked (google, facebook, sso)
- 2FA enabled
- 2FA disabled
- login event (also recorded in `login_events` table for structured query access)