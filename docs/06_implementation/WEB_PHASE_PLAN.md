# Wayfield — Web Phase Plan
## docs/06_implementation/WEB_PHASE_PLAN.md

This document is the authoritative history of web admin phases 1–14, covering
what each phase built, which API phases it depended on, and its completion status.

Web phases use their own numbering (Web 1–9 for core admin, Improvement Phases 10–14)
which is independent of the API phase numbering (0–9). This document maps the two systems.

> All web phases through Phase 14 are complete.
> Phase 15 (Dashboard Analytics) is the next phase to build.

---

## Web Phases 1–9 — Core Admin

---

### Web Phase 1 — Foundation, Auth, Shell, Announcements

**Status:** ✅ Complete
**API dependencies:** API Phase 1 (auth endpoints, /me, organizations)

**What was built:**

- Next.js 16 App Router setup
- **Proxy pattern** — `proxy.ts` is the API proxy (not `middleware.ts`, which is
  a Next.js 16 breaking change from earlier conventions)
- **Tailwind v4** — configured via `@theme` block in `globals.css`. No
  `tailwind.config.ts` file is used.
- Auth pages: Login, Register, Forgot Password, Reset Password, Verify Email
- Admin shell: sidebar navigation, TopBar with dynamic page title
- `UserContext` — shared authenticated user state across the admin shell
- `PageContext` — dynamic TopBar title driven by the active page
- Typed API client: `apiGet`, `apiPost`, `apiPatch`, `apiDelete` wrapper functions
- System announcement banner — reads active announcements from
  `GET /api/v1/system/announcements` and displays at the top of the shell
- Brand fonts loaded: Sora (headings), Plus Jakarta Sans (body), JetBrains Mono (accent)
- Brand colours implemented as CSS custom properties matching MASTER_PROMPT.md palette

**Exit criteria met:** Users can log in and see the authenticated admin shell.

---

### Web Phase 2 — Organisation Management

**Status:** ✅ Complete
**API dependencies:** API Phase 1 (organizations, organization_users, subscriptions)

**What was built:**

- Organisation Settings page — edit name, slug, contact details, logo
- Organisation Members list — display members with role badges
- Billing page — Stripe Checkout integration for plan upgrades

**Exit criteria met:** Owner can edit organisation details, view members, access billing.

---

### Web Phase 3 — Workshop List, Detail, Logistics

**Status:** ✅ Complete
**API dependencies:** API Phase 2 (workshops, workshop_logistics, public_pages)

**What was built:**

- Workshop list with plan limit indicators (e.g., "2/2 workshops used")
- Create Workshop slide-over
- Workshop detail page with full tab bar:
  Overview · Edit · Sessions · Leaders · Participants · Attendance · Notifications
- Workshop logistics tab (hotel, parking, meeting room, meetup instructions)
- Workshop publish and archive actions

**Exit criteria met:** Organiser can create a workshop, edit it, navigate all tabs.

---

### Web Phase 4 — Session Builder

**Status:** ✅ Complete
**API dependencies:** API Phase 3 (sessions, tracks, capacity enforcement, selections)

**What was built:**

- Session builder slide-over (create and edit)
- Track management within the session builder
- Virtual delivery fields: `delivery_type`, `virtual_participation_allowed`,
  `meeting_url`, `meeting_platform`, `meeting_instructions`
- Session deselection guard wired to API
  (`CannotDeselectCheckedInSessionException` surfaces as UI error)
- Double-booking prevention wired to API

**Exit criteria met:** Organiser can create sessions with tracks, capacity, virtual delivery.

---

### Web Phase 5 — Leader Management

**Status:** ✅ Complete
**API dependencies:** API Phase 4 (leaders, leader_invitations, session_leaders)

**What was built:**

- Leader list on the workshop Leaders tab
- Invite Leader slide-over (email, optional first/last name, workshop association)
- Leader detail slide-over (profile view, invitation status, session assignments)
- Session assignment UI — assign/unassign leaders to sessions
- Privacy enforcement — only public-safe leader fields displayed in shared views

**Exit criteria met:** Organiser can invite leaders, view status, assign to sessions.

---

### Web Phase 6 — Participants and Attendance

**Status:** ✅ Complete
**API dependencies:** API Phase 3/5 (registrations, attendance_records, session_leaders)

**What was built:**

- Participant list for workshops with phone number visibility controlled by role:
  shown to `owner`, `admin`, `staff`, assigned leaders; hidden from `billing_admin`
- Roster view per session
- Attendance tab with check-in status per participant
- Organiser add/remove participant from session (uses Phase 8B endpoints)

**Exit criteria met:** Organiser can view participants and manage attendance.

---

### Web Phase 7 — Notifications

**Status:** ✅ Complete
**API dependencies:** API Phase 6 (notifications, notification_recipients)

**What was built:**

- Notification composer — create and send workshop notifications
- Notification history list
- Notification bell in TopBar with live unread count badge
- Mark notification as read

**Exit criteria met:** Organiser can compose/send notifications; bell shows unread count.

---

### Web Phase 8 — Public Workshop Page and Discovery

**Status:** ✅ Complete
**API dependencies:** API Phase 2/9 (public workshop endpoint, discovery endpoint)

**⚠️ Note:** Workshop discovery was planned as a Phase 3 (Growth) product feature
in `MVP_SCOPE.md`. It was implemented here ahead of plan.
See DRIFT_REPORT.md item #6 and DECISIONS.md DEC-031.

**What was built:**

- Public workshop page at `/w/[slug]` — uses `PublicWorkshopResource`
- Workshop discovery listing at `/discover` — uses `PublicWorkshopDiscoveryResource`

**Exit criteria met:** Public workshop pages render correctly. Discovery shows published workshops.

---

### Web Phase 9 — Reports and Polish

**Status:** ✅ Complete
**API dependencies:** API Phase 8 (reporting endpoints)

**What was built:**

- Reports page (attendance, workshop, usage reports)
- Plan limit indicators on workshop list
- Loading, empty, and error states throughout the admin shell
- Mobile responsiveness audit and fixes
- Typography and colour audit

**Exit criteria met:** Reports page shows data. All pages have loading/empty/error states.

---

## Improvement Phases 10–14

---

### Improvement Phase 10 — Onboarding Flow

**Status:** ✅ Complete (with known outstanding bug)
**API dependencies:** `POST /api/v1/me/onboarding/complete`, `onboarding_status` in `/me`

**What was built:**

- Account type selection at registration — `onboarding_intent` field
  (`organizer` or `participant`)
- Post-registration guided wizard:
  - Organiser path: organisation creation steps
  - Participant path: discover workshops / join-by-code options
- Onboarding middleware: redirects users with intent set and
  `onboarding_completed_at IS NULL` to `/onboarding`

**⚠️ Outstanding bug (AR-3):** Middleware must check `onboarding_intent IS NOT NULL`
before redirecting. Users who registered before the onboarding system was added have
`onboarding_intent = null` and must never be sent to `/onboarding`. The condition
fix is tracked in the Audit Remediation checklist.

**⚠️ Outstanding task (AR-5):** All seeded test accounts must have
`onboarding_completed_at` set to bypass the onboarding redirect during development.
- Organiser accounts: `onboarding_intent = 'organizer'`, `onboarding_completed_at` set
- Participant accounts: `onboarding_intent = 'participant'`, `onboarding_completed_at` set
- Leader accounts: `onboarding_intent = null` (bypass applies automatically)

**Exit criteria met:** New users see onboarding wizard. Users without intent bypass it
(when bug is fixed).

---

### Improvement Phase 11 — Image Uploads and Profile Pictures

**Status:** ✅ Complete
**API dependencies:** `POST /api/v1/files/presigned-url`, `POST /api/v1/files/confirm`

**What was built:**

- S3 presigned URL upload flow (two-step: request URL → upload directly to S3 → confirm)
- Shared `ImageUploader` component in two variants:
  - Rectangle — for workshop headers, session headers, organisation logos
  - Circle — for user profile pictures and leader profile pictures
- Images integrated into: workshop create/edit form, session create/edit form,
  organisation settings, leader profile slide-over, logistics hotel section
- CloudFront delivery URL returned after confirmation
- Local development fallback: `POST /api/v1/files/local-upload` (bypasses S3)
- Profile page at `/admin/profile` for user profile picture and account settings

**Schema additions (added via migration, not in original phase plan):**
- `users.profile_image_url`
- `workshops.header_image_url`
- `sessions.header_image_url`
- `organizations.logo_url`

**Exit criteria met:** Images can be uploaded for all supported entities.
CloudFront URLs stored and served.

---

### Improvement Phase 12 — Session Detail Screen

**Status:** ✅ Complete
**API dependencies:** Existing session endpoints

**What was built:**

- Dedicated session detail page at `/admin/workshops/[id]/sessions/[sessionId]`
- Two-column layout:
  - Left: session details (title, description, timing, location, virtual details, notes)
  - Right: leaders, capacity bar, publish action, links
- Edit button opens the existing session slide-over (no separate form built)
- Publish button for unpublished sessions (runs publish validation)
- Virtual meeting details section with copy-to-clipboard buttons
- Capacity bar with colour thresholds: green → amber at 80% → red at 100%
- Link to the Attendance tab pre-filtered to this session

**Exit criteria met:** Clicking a session title navigates to its dedicated detail page.

---

### Improvement Phase 13 — Notification Detail View

**Status:** ✅ Complete
**API dependencies:** `GET /api/v1/workshops/{workshop}/notifications/{notification}`

**What was built:**

- Notification history table rows are clickable (previously list-only)
- Right slide-over panel with full notification content (no truncation)
- Type badge (informational / urgent / reminder) and scope badge
- Notification bell: mark-as-read action, navigation to notification source

**Exit criteria met:** Clicking a notification row opens its detail slide-over.

---

### Improvement Phase 14 — Add Participants to Sessions

**Status:** ✅ Complete
**API dependencies:**
`POST /api/v1/workshops/{w}/sessions/{s}/participants`,
`GET /api/v1/organizations/{org}/participants/search`

**What was built:**

- Organiser can search registered participants by email and add them to a specific session
- `AddParticipantModal` component — email input, search results, capacity warning
- Entry points: Attendance tab and Session Detail page both show "Add Participant" button
- Capacity enforcement on add (API returns 422 if session is at capacity)
- "Not registered" error surfaces join code hint for the workshop
- Audit log written on every add

**Exit criteria met:** Organiser can search registered participants and add them to sessions
with capacity enforcement and audit trail.

---

## Next: Phase 15 — Dashboard Analytics

**Status: ❌ NOT STARTED**

**Scope:**

Plan-aware dashboard metrics replacing the current hardcoded-zero stat cards.

- **Free plan:** core counts only (active workshops, total participants, upcoming sessions)
  with locked analytics cards showing upgrade CTAs
- **Starter plan:** attendance rate, no-show rate, capacity utilization, session
  breakdown bar chart
- **Pro plan:** all Starter metrics plus 12-week registration trend line chart

**UI components to build:**
- `MetricCard` — live metric with sparkline (Starter+)
- `LockedMetricCard` — greyed-out card with lock icon and plan badge (Free plan)
- `StubMetricCard` — placeholder for future metrics (available_on field)
- Session breakdown bar chart (recharts)
- Registration trend chart (recharts, Pro only)

**API requirement:**
The `GET /api/v1/organizations/{org}/dashboard` endpoint must return a plan-aware
metrics payload. The `GET /api/v1/workshops/{workshop}/analytics` endpoint must return
per-workshop breakdown data. Both endpoints should be verified against the actual
implementation before building the UI.

---

## API Phase to Web Phase Dependency Map

| API Phase | Web phase(s) that consume it |
|---|---|
| API 0 (scaffold) | Web 1 (infrastructure) |
| API 1 (auth, orgs, identity) | Web 1 (auth), Web 2 (org management) |
| API 2 (workshops, locations, public) | Web 3 (workshop detail), Web 8 (public/discovery) |
| API 3 (sessions, capacity, selections) | Web 4 (session builder), Web 6 (participants) |
| API 4 (leaders, invitations) | Web 5 (leader management) |
| API 5 (attendance, roster, messaging) | Web 6 (attendance), Web 7 (notifications) |
| API 6 (notifications, preferences) | Web 7 (notifications) |
| API 7 (offline sync) | Mobile only — not consumed by web |
| API 8 (feature gating, reporting) | Web 9 (reports), Phase 15 (dashboard) |
| API 8B (session participants) | Phase 14 (add participants) |
| API 9 (enterprise, webhooks, API keys) | Phase 10 (onboarding), Web 8 (discovery) |
| CC-API 1–5 | CC Web 1–4 (not started) |
| Files (Phase 11 endpoints) | Phase 11 (image uploads) |