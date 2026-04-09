# Notifications and Messaging System Specification
## docs/02_domain/NOTIFICATIONS_AND_MESSAGING_SYSTEM.md

**Source authority:** Constitutional rules in `MASTER_PROMPT.md` govern.
Leader messaging constraint canonical definition: `docs/02_domain/ROLE_MODEL.md` Section 3.
Canonical schema: `DATA_SCHEMA_FULL.md` Tables 24–26.

---

## Notification Entity

**Table: `notifications`** — see `DATA_SCHEMA_FULL.md` Table 24.

| Field | Type | Notes |
|---|---|---|
| `id` | BIGINT PK | |
| `organization_id` | BIGINT FK | required |
| `workshop_id` | BIGINT FK | required |
| `session_id` | BIGINT FK nullable | required for all leader-created notifications |
| `created_by_user_id` | BIGINT FK | required |
| `title` | VARCHAR | required |
| `message` | TEXT | required |
| `notification_type` | ENUM | `informational`, `urgent`, `reminder` |
| `sender_scope` | ENUM | `organizer`, `leader` |
| `delivery_scope` | ENUM | `all_participants`, `leaders`, `session_participants`, `custom` |
| `sent_at` | DATETIME nullable | |
| `created_at`, `updated_at` | DATETIME | |

**`custom` delivery scope:** The `custom` value is reserved in the schema but is
not implemented. Any attempt to create a notification with `delivery_scope = 'custom'`
throws `CustomDeliveryNotImplementedException` and returns HTTP 501 Not Implemented.
The recipient resolution strategy for a custom-selected list has not been designed.
Do not attempt partial implementation. See `docs/stabilization/OPEN_QUESTIONS.md` Q3.

---

## Recipient Tracking

**Table: `notification_recipients`** — see `DATA_SCHEMA_FULL.md` Table 25.

`ResolveNotificationRecipientsService` populates this table from the delivery scope
at notification creation time. It tracks per-channel delivery status:
`email_status`, `push_status`, `in_app_status`.

---

## Notification Channels

Three delivery channels are supported. All notification delivery is queued —
never synchronous.

1. **Email** — dispatched via `SendEmailNotificationJob` → `WorkshopNotificationMail`
2. **Push notification** — dispatched via `SendPushNotificationJob`; uses Firebase
   Cloud Messaging / Expo Push; skips silently in local/test environments
3. **In-app** — stored in `notification_recipients.in_app_status`; retrieved
   via `GET /api/v1/me/notifications`; marked read via `PATCH`

All jobs must support retry. Delivery failures are tracked per-channel per-recipient
in `notification_recipients`.

---

## Transactional Emails — Bypass Rule

The following email types are **transactional** and are sent regardless of a user's
`notification_preferences` settings:

- Email address verification (`EmailVerificationMail`)
- Password reset (`PasswordResetMail`)
- Leader invitation (`LeaderInvitationMail`)
- Workshop join confirmation (`WorkshopJoinConfirmationMail`)
- Workshop change notification (`WorkshopChangeNotificationMail`)
- Organisation member invitation (`OrgMemberInvitationMail`)

These are dispatched via dedicated Mailable classes directly, not through the
notification delivery pipeline. They are not routed through
`ResolveNotificationRecipientsService` and are not affected by preference opt-outs.

Reason: these messages are required for core account and system function. Allowing
opt-out would break authentication and invitation flows.

---

## Sender Scope Rules

### `sender_scope = 'organizer'`

Organisation members with `owner`, `admin`, or `staff` roles may create notifications.

Allowed `delivery_scope` values:
- `all_participants` — all registered participants in the workshop
- `leaders` — all confirmed leaders associated with the workshop
- `session_participants` — participants of a specific session (`session_id` required)
- `custom` — reserved; throws 501 (see above)

### `sender_scope = 'leader'`

Leaders may create notifications under strict constraints. See the Leader Messaging
Constraint section below.

---

## Leader Messaging Constraint

The canonical definition of this constraint is in
**`docs/02_domain/ROLE_MODEL.md` Section 3**. The summary below is provided for
context; the canonical document governs in any conflict.

**Scope constraint:**
A leader may only send notifications to participants enrolled in sessions they are
explicitly assigned to via `session_leaders`. The `session_id` field is required on
all leader-created notifications and must reference an assigned session.
`delivery_scope` must be `session_participants`.

**Time window:**
Notifications are accepted only when the current time falls within:
- 4 hours before `session.start_at` (parent workshop timezone)
- through 2 hours after `session.end_at` (parent workshop timezone)

All timezone calculations must use the parent workshop's `timezone` field.
Not UTC. Not the server's local timezone.

**Plan gate:**
Leader-to-participant notifications require Starter plan or higher.
Free plan returns HTTP 403:
```json
{ "error": "plan_required", "required_plan": "starter" }
```

**Enforcement layers (all three are required; none is optional):**
1. `EnforceLeaderMessagingRulesService` — validates assignment, scope, and time
   window before creating the notification record
2. UI — hides the notification compose interface outside the valid window
3. `audit_logs` — all leader notifications write an audit entry regardless of
   whether the notification was accepted or rejected

**A notification is rejected with HTTP 422 if:**
- `session_id` is missing on a leader notification
- the leader is not assigned to the referenced session via `session_leaders`
- `session_leaders.assignment_status` is not `accepted` for the leader
- the current time is outside the allowed window
- any participant in the target set is not enrolled in the referenced session

---

## Notification Preferences

**Table: `notification_preferences`** — one row per user (UNIQUE on `user_id`).

Supported preferences: `email_enabled`, `push_enabled`, `in_app_enabled`,
`workshop_updates_enabled`, `reminder_enabled`, `marketing_enabled`.

Preferences are checked by `QueueNotificationDeliveryAction` before dispatching
each channel. A channel with a disabled preference is skipped.

**Exception:** Transactional emails (listed above) always bypass preference checks.

---

## Push Notifications

- Platform: Firebase Cloud Messaging / Expo Push
- Push tokens stored in `push_tokens` table (UNIQUE on `push_token`)
- Token registered via `POST /api/v1/me/push-tokens`
- Token deactivated on delivery failure
- Must support scheduled delivery and urgent overrides

---

## In-App Notification Centre

- `GET /api/v1/me/notifications` — returns notifications for the authenticated user
- `PATCH /api/v1/me/notifications/{notificationRecipient}/read` — marks as read
- Unread count drives the notification bell badge in the web admin

---

## Email System Requirements

In addition to transactional emails, the notification system must support:
- Workshop and session change notifications (queued, respects preferences)
- Reminder emails (automation — Starter plan feature, not yet implemented)
- Urgent alerts

---

## Audit Requirements

Log to `audit_logs`:
- notification created (all types)
- notification sent (on actual dispatch)
- leader notification — with full context: `leader_id`, `session_id`, `workshop_id`,
  `organization_id`, `delivery_scope`, timestamp, outcome (accepted or rejected)