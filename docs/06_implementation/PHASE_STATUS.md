# Wayfield — Phase Build Status
## docs/06_implementation/PHASE_STATUS.md

**This is the canonical progress tracker for all Wayfield phases.**
It replaces `docs/deprecated/BUILD_SEQUENCE_CHECKLIST.md`.

> Last updated: 2026-04-06 (documentation remediation)
>
> **Current state, stated precisely:**
> - API backend: complete through Phase 9 plus Command Center API phases
> - Web / Improvement: complete through Phase 14 (Add Participants to Sessions)
> - Phase 15, Phase 16, Audit Remediation, Command Center Frontend,
>   and Mobile are **NOT complete and must not be described as complete**

---

## Phase End Update Requirement

At the end of every phase, update all five items before marking it done:

1. This file — mark complete; record implementation notes and deviations
2. `CLAUDE.md` — update "Current Build Phase" block
3. `docs/stabilization/DECISIONS.md` — log non-obvious decisions
4. `docs/stabilization/OPEN_QUESTIONS.md` — close resolved; add new questions
5. `docs/03_schema/DATA_SCHEMA_FULL.md` if migrations changed;
   `docs/04_api/API_ROUTE_SPEC.md` if routes changed

Tests must be passing before a phase is marked complete.

---

## API Backend Phases

| Phase | Name | Status | Implementation Notes |
|---|---|---|---|
| 0 | Architecture and project setup | ✅ DONE | Monorepo: `api/`, `web/`, `mobile/`, `command/` |
| 1 | Identity, people, tenant foundation, auth extensions | ✅ DONE | Column is `password_hash` not `password` (DEC-004). Custom `password_reset_tokens` table (DEC-005). |
| 2 | Workshops, locations, public pages | ✅ DONE | — |
| 3 | Tracks, sessions, selections, capacity, virtual delivery | ✅ DONE | `registrations` and `session_selections` built here — not Phase 5 as the old checklist incorrectly stated. |
| 4 | Leaders, invitations, self-managed profiles | ✅ DONE | No `session_id` on `leader_invitations` (DEC-014). Invitation tokens hashed (DEC-013). |
| 5 | Attendance, roster, leader messaging, operational views | ✅ DONE | `session_leaders.assignment_status` added. `users.phone_number` added. |
| 6 | Notifications, transactional email, preferences, auth hardening | ✅ DONE | Mailable classes used (not Notification classes). `custom` delivery_scope deliberately returns 501 (DEC-016). |
| 7 | Offline sync, packaging, mobile resilience | ✅ DONE | SHA-256 version hash; `session_leaders` included in hash (DEC-020). `meeting_url` never in sync package (DEC-021). |
| 8 | Reporting, feature gating, plan enforcement | ✅ DONE | `EnforceFeatureGateService` in place. Manual overrides require owner + audit log (DEC-025). |
| 8B | Session participant management (unplanned addition) | ✅ DONE | `OrganizerAddParticipantToSession`, `OrganizerRemoveParticipantFromSession`. Added during Phase 8 work. |
| 9 | Enterprise readiness — SSO stubs, webhooks, API keys | ✅ DONE | SSO scaffolded, not production-active. Stripe webhook handler not wired (see OPEN_QUESTIONS Q4). |

---

## Command Center API Phases

Built after API Phase 9 as an unplanned expansion. All CC API phases are complete.
The Command Center frontend (`command/`) is a separate Next.js app — see CC Frontend section below.

| Phase | Name | Status | Implementation Notes |
|---|---|---|---|
| CC-API 1 | Platform admin auth, schema foundation | ✅ DONE | `admin_users` table created; replaces deprecated `platform_admins` (AR-10 — drop migration still needed). `auth:platform_admin` Sanctum guard isolated from `auth:sanctum`. `PlatformAuditService` wired. |
| CC-API 2 | Stripe billing integration | ✅ DONE | Stripe mirror tables exist (`stripe_customers`, `stripe_subscriptions`, `stripe_invoices`, `stripe_events`). **Stripe webhook handler is NOT wired** (see OPEN_QUESTIONS Q4). |
| CC-API 3 | Platform dashboard and metrics | ✅ DONE | Overview endpoint, organisations list with usage, organisation detail, users list, security events endpoints. |
| CC-API 4 | Automation engine | ✅ DONE | `TriggerInterface` + 5 built-in triggers. `ActionInterface` + 4 built-in actions. Automation CRUD endpoints. **Automation execution engine (scheduler/runner) is NOT implemented** (see OPEN_QUESTIONS Q8). |
| CC-API 5 | Feature flags, admin management, audit endpoints | ✅ DONE | Feature flag management endpoints. Admin user management with last-super-admin guard. Audit log endpoints. Crisp integration skipped — support section is placeholder only. |

---

## Web Admin Phases

| Phase | Name | Status | Implementation Notes |
|---|---|---|---|
| Web 1 | Foundation, auth, shell, announcements | ✅ DONE | Next.js 16: `proxy.ts` pattern (not `middleware.ts`). Tailwind v4 `@theme` in `globals.css`. `UserContext` + `PageContext`. |
| Web 2 | Organisation management | ✅ DONE | Settings, members, billing with Stripe Checkout. |
| Web 3 | Workshop list, detail, logistics | ✅ DONE | Workshop tab bar. |
| Web 4 | Session builder | ✅ DONE | Slide-over, tracks, virtual delivery fields, `virtual_participation_allowed` toggle. |
| Web 5 | Leader management | ✅ DONE | Invite, detail slide-over, session assignment, privacy enforcement. |
| Web 6 | Participants and attendance | ✅ DONE | Phone visibility by role (`owner`/`admin`/`staff`/assigned leader — not `billing_admin`). Roster, attendance tab, add/remove participant from session. |
| Web 7 | Notifications | ✅ DONE | Notification composer, history, notification bell with unread badge. |
| Web 8 | Public workshop page and discovery | ✅ DONE | `/w/[slug]` and `/discover`. ⚠️ Discovery was a planned Growth feature (MVP_SCOPE.md Phase 3); implemented here ahead of plan (DEC-031). |
| Web 9 | Reports and polish | ✅ DONE | Reports page, loading/empty/error states, mobile responsiveness. |

---

## Improvement Phases

| Phase | Name | Status | Implementation Notes |
|---|---|---|---|
| 10 | Onboarding flow | ✅ DONE | ⚠️ Middleware bug outstanding (AR-3): must check `onboarding_intent IS NOT NULL` before redirecting. Seeder not yet updated (AR-5). |
| 11 | Image uploads and profile pictures | ✅ DONE | S3 presigned URL flow. `header_image_url` on workshops/sessions. `logo_url` on organisations. `profile_image_url` on users/leaders. |
| 12 | Session detail screen | ✅ DONE | `/admin/workshops/[id]/sessions/[sessionId]` two-column layout. |
| 13 | Notification detail view | ✅ DONE | Slide-over panel, full message body, mark-as-read. |
| 14 | Add participants to sessions | ✅ DONE | Organizer email search, add to session, capacity enforced, audit logged. **Last completed phase.** |
| **15** | **Dashboard analytics** | ❌ **NOT STARTED** | Plan-aware metrics; locked cards for Free plan; session breakdown chart; 12-week registration trend (Pro). |
| 16 | International address system | ✅ DONE | `addresses` canonical table; 5 migrations (non-destructive); `AddressService`; 20 country configs in `config/address_countries.php`; timezone inference in `config/address_timezones.php`; address endpoints; `addresses:migrate` command; existing columns preserved; 32 tests pass. |

---

## Audit Remediation Items

Identified in the 2026-04-06 stabilisation audit. None are implemented in code.

| Item | Description | Status |
|---|---|---|
| AR-1 | `users.phone_number` exposed in `/me` response and writable via `PATCH /me` | ❌ Not done |
| AR-2 | `billing_admin` explicitly denied at API policy level for all non-billing endpoints | ❌ Not done |
| AR-3 | Onboarding middleware: check `onboarding_intent IS NOT NULL` before redirect | ❌ Not done |
| AR-4 | Leader notification plan gate: Free plan returns 403 with `plan_required` error | ❌ Not done |
| AR-5 | Seeder: all test accounts have correct `onboarding_intent` and `onboarding_completed_at` | ❌ Not done |
| AR-6 | `config/plans.php`: clarify capacity enforcement is always-on; UI gate is Starter+ only | ❌ Not done |
| AR-7 | Documentation corrections (this remediation batch) | ✅ In progress |
| AR-8 | `ROLE_MODEL.md` created and referenced in all `CLAUDE.md` files | ✅ In progress |
| AR-9 | `billing_admin` sidebar restriction enforced in web admin | ❌ Not done |
| AR-10 | Drop deprecated `platform_admins` table (write and run down migration) | ❌ Not done |

See `docs/stabilization/OPEN_QUESTIONS.md` for unresolved design questions.
See `docs/deprecated/BUILD_SEQUENCE_CHECKLIST.md` for the original (unmaintained) task checklist.

---

## Command Center Frontend

**Status: NOT STARTED**

The `command/` Next.js application contains only the initial scaffold (`app/layout.tsx` and `app/page.tsx`).
No domain screens, no auth flow, no navigation shell, no data fetching.
The API backend that this frontend will consume is fully built and ready.

| Phase | Name | Status |
|---|---|---|
| CC-Web 1 | Auth, shell, overview dashboard | ❌ NOT STARTED |
| CC-Web 2 | Organisation management | ❌ NOT STARTED |
| CC-Web 3 | Users, financials, support | ❌ NOT STARTED |
| CC-Web 4 | Automations, security, audit, settings | ❌ NOT STARTED |

Phase prompts: `docs/command_center/COMMAND_CENTER_PHASE_PROMPTS.md`

---

## Mobile App

**Status: NOT STARTED**

The `mobile/` Expo project is scaffolded only. No domain screens exist.
The offline sync API (Phase 7) is fully built and waiting for a mobile client.

| Phase | Name | Status |
|---|---|---|
| Mobile 1 | Foundation and auth | ❌ NOT STARTED |
| Mobile 2 | Workshop experience | ❌ NOT STARTED |
| Mobile 3 | Attendance and offline sync | ❌ NOT STARTED |
| Mobile 4 | Leader tools | ❌ NOT STARTED |
| Mobile 5 | Notifications and polish | ❌ NOT STARTED |

---

## What Is Deliberately Incomplete (Not Bugs)

These are known placeholders — intentionally incomplete, not forgotten or overlooked:

| Feature | Placeholder State | Reference |
|---|---|---|
| 2FA activation | All `TwoFactorController` endpoints return 501 | DEC-007 |
| Social login (Google/Facebook) | Schema exists; not wired for production | DEC-006 |
| `custom` delivery_scope | Throws `CustomDeliveryNotImplementedException` (501) | DEC-016 |
| Stripe webhook handler | Tables exist; handler not implemented | DEC-023, Q4 |
| Automation execution engine | Schema and interfaces exist; no scheduler/runner | Q8 |
| Crisp support integration | `crisp_conversations` table exists; no webhook handler | Q11 |
| SSO production wiring | `SsoController` and schema exist; not production-active | DEC-006 |
| Waitlists | No schema or implementation | Q7 |
