# Wayfield MVP Scope and Phase Roadmap

## Source Authority
This file defines what ships in each delivery phase from a product perspective.
It does not define the technical build sequence — that lives in:
`docs/06_implementation/PHASED_IMPLEMENTATION_PLAN.md`

---

## MVP — Phase 1 Product Delivery

The following capabilities are required in the initial production release:

### Identity and Auth
- Authentication on web and mobile (email/password)
- Email verification
- Password reset
- Future-ready Google/Facebook auth conduit schema
- Future-ready 2FA schema

### Organizations
- Organization creation
- Multiple organization admins/managers
- Primary organization contact (first_name, last_name, email, phone)

### Workshops
- Workshop creation (session-based and event-based)
- Workshop default location
- Hotel and logistics information
- Session scheduling
- Optional session capacity enforcement
- delivery_type support: in_person, virtual, hybrid
- Meeting link validation for virtual/hybrid sessions
- Public workshop pages

### Leaders
- Leader invitations
- Leader profile completion by the leader
- Leader public visibility (accepted leaders only)

### Participants
- Participant join by code
- Session selection (session-based workshops)
- Participant self-check-in
- Personal schedule view

### Operational
- Leader roster access (assigned sessions only)
- Leader attendance override and no-show marking
- Organizer notifications (basic)
- Transactional email (verification, invitation, reset, confirmation)
- Offline access: workshop overview, logistics, schedule

---

## Phase 2 — Post-MVP Enhancements

Everything in MVP, plus:
- Waitlists
- Branded/custom pages
- Light custom domain support
- Reminder automation (email)
- Leader day-of-session notifications
- Basic analytics
- Attendance summaries

---

## Phase 3 — Growth Features

Everything in Phase 2, plus:
- Advanced automation
- Notification segmentation
- Multi-workshop reporting
- API access
- Webhooks
- Advanced role-based permissions
- Google/Facebook login implementation (active, not just schema)
- 2FA implementation (active, not just schema)

---

## Phase 4 — Enterprise and Platform

Everything in Phase 3, plus:
- SSO
- Enterprise governance controls
- White-label
- External integrations
- Workshop discovery and search
- Custom integrations and onboarding
