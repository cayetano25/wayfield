# Wayfield – Open Questions

> Stabilization artifact. Records unresolved questions that affect implementation,
> schema, or documentation decisions.
> Items here must not be silently closed. Each item must be explicitly resolved
> with a dated note and reference to the decision or commit that closes it.

---

## Status Key

| Status | Meaning |
|---|---|
| 🔴 Open | Unresolved; blocks or creates drift |
| 🟡 Deferred | Acknowledged; resolution intentionally deferred to a later phase |
| 🟢 Resolved | Closed; resolution recorded below the item |

---

## Identity and Auth

### OQ-001 — Mobile Token Refresh Expiry Duration
**Status:** 🔴 Open
**Source:** `IDENTITY_AND_AUTH.md` — "Mobile tokens must support refresh — expiry durations are an open question"
**Question:** What is the intended expiry duration for Sanctum tokens on the mobile platform? Should mobile tokens be long-lived, or should a refresh token mechanism be implemented?
**Impact:** Mobile auth lifecycle behavior is undefined. If tokens expire too quickly, the mobile offline-first experience breaks. If too long, revocation security is weakened.
**Resolution required before:** Mobile app build (Phase CC-mobile)

---

### OQ-002 — Email Verification Token Expiry Duration
**Status:** 🟡 Deferred
**Source:** `IDENTITY_AND_AUTH.md` — "Email verification tokens must expire (duration TBD)"
**Question:** What is the intended expiry window for email verification tokens?
**Common choices:** 24 hours, 48 hours, 7 days.
**Impact:** Low for current build; Laravel default may be acceptable for MVP.
**Resolution required before:** Production launch

---

### OQ-003 — Password Reset Token Expiry Duration
**Status:** 🟡 Deferred
**Source:** `IDENTITY_AND_AUTH.md` — "Password reset tokens must expire (duration TBD)"
**Question:** What is the intended expiry window for password reset tokens?
**Common choices:** 60 minutes, 2 hours.
**Impact:** Low for current build; Laravel default (60 minutes) is reasonable.
**Resolution required before:** Production launch

---

## Sessions and Scheduling

### OQ-004 — Hybrid Session `virtual_participation_allowed` Flag
**Status:** 🔴 Open
**Source:** Canonical `SESSION_AND_CAPACITY_MODEL.md` — "OPEN ISSUE: There is currently no `virtual_participation_allowed` field or equivalent on the sessions table to indicate which hybrid sessions require meeting_url. This flag must be resolved before Phase 3 implementation."
**Question:** How does the system know whether a `hybrid` session requires `meeting_url`? The current schema has no field for this. As a result, the publish validation rule is ambiguous for hybrid sessions.
**Options:**
1. Add `virtual_participation_allowed BOOLEAN` to sessions table (requires migration)
2. Always require `meeting_url` for hybrid sessions (simplest, may be over-restrictive)
3. Treat hybrid sessions as always requiring virtual access (implicit assumption)
**Impact:** Affects session publish validation logic in the API. If not resolved, hybrid sessions may behave incorrectly at publish time.
**Resolution required before:** Phase 3 is considered stable

---

### OQ-005 — Session Soft Delete Strategy
**Status:** 🔴 Open
**Source:** Canonical `SESSION_AND_CAPACITY_MODEL.md` — "Session deletion or deactivation behavior is an open question"
**Question:** Can sessions be deleted? If so:
- What happens to existing attendance records?
- What happens to session selections?
- Should sessions use soft delete (`deleted_at`) or hard delete?
- Should deletion be blocked if attendance records exist?
**Impact:** Admin UI (Web Admin) session management behavior depends on this decision.
**Resolution required before:** Phase 15 or any session management UI hardening

---

### OQ-006 — Session Capacity Race Condition
**Status:** 🟡 Deferred
**Source:** Canonical `SESSION_AND_CAPACITY_MODEL.md` — "Simultaneous session selection creates a race condition risk. Enforcement must use database-level locking."
**Question:** Has the capacity enforcement service been implemented with `SELECT ... FOR UPDATE` or an equivalent optimistic locking approach? Has this been tested under concurrent selection?
**Impact:** At scale, simultaneous selection requests could allow overbooking.
**Resolution required before:** Production launch or any capacity-enforcement load testing

---

## Workshops

### OQ-007 — `public_slug` Generation Rules
**Status:** 🔴 Open
**Source:** Canonical `WORKSHOP_DOMAIN_MODEL.md` — "URL routed via `public_slug` (generation rules: open issue)"
**Question:** How is `public_slug` generated?
- Is it derived from the workshop title (slugified)?
- Is it user-editable?
- What are the uniqueness and collision-resolution rules?
- What happens if the title changes after the slug is set?
**Impact:** Public workshop page URL behavior is undefined. This affects routing, SEO, and shareable URL stability.
**Resolution required before:** Public workshop page feature is promoted

---

### OQ-008 — Archived Workshop Registration Behavior
**Status:** 🟡 Deferred
**Source:** `PHASED_IMPLEMENTATION_PLAN.md` — "Archived workshop cannot accept new registration flows if policy disallows it"
**Question:** Is the "if policy disallows it" condition always true? Should archived workshops always block new registrations, or is there a scenario where an archived workshop remains joinable?
**Impact:** Registration endpoint behavior for archived workshops.
**Resolution required before:** Any registration flow is hardened

---

## Leaders

### OQ-009 — Leader Profile Public Bio — Snippet vs Full Text
**Status:** 🟡 Deferred
**Source:** Multiple permission docs reference "bio snippet" as the public field
**Question:** Is the full `bio` field exposed publicly, or only a truncated excerpt? If a snippet:
- What is the character limit?
- Is truncation done at the API or UI level?
**Impact:** Public leader serializer and leader card UI rendering.
**Resolution required before:** Public workshop page is promoted

---

## Roles and Permissions

### OQ-010 — `ROLE_MODEL.md` Creation
**Status:** 🔴 Open
**Source:** DEC-011 — "ROLE_MODEL.md must be created before or alongside Phase 15 work"
**Question:** `ROLE_MODEL.md` has been decided upon as the canonical role authority but has not been created yet.
**Impact:** Until it exists, role documentation is fragmented and "Organizer" remains ambiguously defined.
**Resolution required before:** Phase 15 begins

---

### OQ-011 — Leader Permission to View Own Org Members
**Status:** 🔴 Open
**Source:** Not currently addressed in any permission document
**Question:** Can a leader (accepted, with a user account) see other leaders assigned to the same workshop? Can they see the organizer's contact info?
**Impact:** Leader-facing mobile app UI and Command Center leader view.
**Resolution required before:** Mobile app build or Command Center CC-5 (Leaders view)

---

## Notifications

### OQ-012 — Leader Messaging as Starter+ Feature
**Status:** 🟡 Deferred
**Source:** `PRICING_AND_TIERS.md` — "Leader day-of-session notifications should be treated as a Starter-tier feature or higher"
**Question:** Is the leader messaging time-window constraint applied even on the Free plan (where leader notifications are not a feature)? Or is the constraint only relevant once the feature is enabled on Starter+?
**Statement:** The hard constraint (scope + time window) ALWAYS applies regardless of plan. But the question is whether leaders on a Free-plan org can send notifications at all.
**Impact:** Feature gating service configuration for leader notifications.
**Resolution required before:** Phase 15 (plan enforcement in UI)

---

## Infrastructure

### OQ-013 — Command Center Deployment Strategy
**Status:** 🟡 Deferred
**Source:** `COMMAND_CENTER_IMPLEMENTATION_GUIDE.md`
**Question:** Where is the Command Center deployed relative to the Web Admin?
- Separate Vercel/Amplify project?
- Subdomain of `wayfield.app` (e.g., `cc.wayfield.app`)?
- Path-based routing on the same domain?
**Impact:** Auth cookie strategy, CORS configuration, and deployment pipeline depend on this.
**Resolution required before:** Command Center CC-1 (project setup) begins

---

### OQ-014 — Custom Domain Support Implementation
**Status:** 🟡 Deferred
**Source:** `PRICING_AND_TIERS.md` — "light custom domain support" on Starter plan
**Question:** What does "light custom domain support" mean in practice? CNAME-based? Proxy-based? SSL provisioning?
**Impact:** Infrastructure scope for Starter tier is undefined.
**Resolution required before:** Phase 15 (plan features) or marketing commitment to this feature

---

## Documentation

### OQ-015 — `docs/` Hierarchy Migration Execution
**Status:** 🔴 Open
**Source:** DEC-014 and DOCUMENTATION_RESTRUCTURE_PLAN.md
**Question:** The migration plan exists. When will the physical file migration happen? Who executes it? Does it require a monorepo PR?
**Impact:** Until migration is executed, canonical docs are not in their canonical locations.
**Resolution required before:** Any new documentation is created (to ensure it goes in the right place)