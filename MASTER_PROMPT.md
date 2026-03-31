# Wayfield – Master Claude Prompt (v4)

You are acting as a senior product architect, UX strategist, backend engineer, mobile engineer, web engineer, database designer, QA strategist, and DevOps advisor for a production-bound SaaS platform called Wayfield.

Your job is to generate production-quality assets, code structure, implementation guidance, and phased delivery outputs for a multi-tenant workshop management platform focused initially on photography workshops and creative education events.

Do not treat this as a toy app. Treat it as a real SaaS platform that must be secure, extensible, role-aware, offline-capable on mobile, and ready for phased delivery by a solo builder working part-time.

This version includes critical rules:
- Every person entity in the system must support first_name and last_name separately.
- Primary authentication must use email address and password across web and mobile.
- The identity system must be designed to support social login conduits for Google and Facebook.
- The identity system must be designed to support two-factor authentication.
- Sessions and event-style schedule items may optionally enforce maximum capacity.
- Leaders must be able to complete and maintain their own profile details after receiving an invitation.
- Leader addresses may be stored privately, but only city and state/region should be shown on public workshop pages and participant-facing workshop surfaces unless a stricter rule is defined later.
- If a session or event is virtual or hybrid with virtual participation, a meeting link must be provided before it can be published for participants, and participant-facing interfaces must provide a Join Meeting action.

## Primary Objective

Generate the necessary assets to build Wayfield in phases, including:
- production-oriented database schema
- API design and backend structure
- mobile application structure
- web admin application structure
- public workshop pages
- email verification and automation model
- push notification and in-app notification model
- role-based permissions
- attendance and roster functionality
- subscription-aware feature gating
- offline-first mobile sync strategy
- phased implementation prompts for Claude Code

## Product Summary

Wayfield is a cross-platform SaaS platform with:
- a mobile app for participants and leaders
- a web admin app for organizers and organizations
- public-facing workshop web pages
- a backend API and database
- push notifications and email communications

The system must support:
- session-based workshops with tracks and selectable sessions
- event-based workshops with a simpler schedule
- optional capacity limits for sessions and event schedule items
- cross-platform participant login on web and mobile using email address and password
- email verification and password reset
- future-ready social login conduits for Google and Facebook
- future-ready two-factor authentication
- public workshop pages
- leader invitations and leader confirmation workflows
- leader-owned profile completion and editing after invitation
- participant self-check-in
- leader attendance override and no-show marking
- leader roster access for assigned sessions only
- participant phone number visibility only to assigned leaders and organizers
- hotel and logistics information on participant and public views
- subscription plans for organizations/admins
- feature gating for premium admin functionality
- future workshop discovery and registration readiness

## Critical Identity Rules

1. Standard login must use:
- email address
- password

2. This applies across:
- web
- mobile

3. The schema and architecture must support future social login linkage for:
- Google
- Facebook

4. The schema and architecture must support future 2FA such as:
- TOTP authenticator app
- email-based one-time codes if needed later
- backup/recovery codes

5. Social login should be treated as an additional identity conduit, not a replacement for core account modeling.

6. A single user account may be linked to multiple authentication methods over time.

## Critical Person and Contact Modeling Rules

1. All real people must have:
- first_name
- last_name
- email where applicable
- phone number where applicable and allowed
- display_name may be derived or stored optionally, but not used as a substitute for first_name and last_name

2. This applies to:
- users
- leaders
- organization contacts
- organization managers/admins
- participants in rosters
- invited leaders

3. Organizations must support contact information that includes:
- primary contact first name
- primary contact last name
- primary contact email
- primary contact phone number

4. Organizations must allow multiple people to manage them.
This must be modeled explicitly, not assumed through a single owner field alone.

5. Organization managers should support role distinctions such as:
- owner
- admin
- staff
- billing_admin, if useful later

## Critical Scheduling and Capacity Rules

1. Sessions may have an optional maximum capacity.
2. Event-based schedule items may also have an optional maximum capacity.
3. If capacity is null, no capacity limit is enforced.
4. If capacity is present, selection/registration/check-in logic must not allow confirmed enrollment beyond that limit unless an explicit override policy exists.
5. Capacity checks must be enforced in backend business rules, not only in the UI.
6. Capacity state should be visible in organizer/admin tools and may be shown to participants where useful.

## Critical Leader Profile Ownership Rules

1. Organizers may invite leaders and create placeholder leader records if needed.
2. Leaders must be able to complete and maintain their own profile after receiving an invitation.
3. A leader invitation flow should support a profile completion screen or form where the invited leader can enter or update:
- first_name
- last_name
- bio
- website
- phone number
- city
- state/region
- mailing/street address if stored privately
- profile image
4. Organizers should not be forced to fill in a leader's bio or personal details.
5. Leader profile data should be reusable across organizations.
6. Public workshop views should only show safe leader profile data:
- name
- bio snippet
- website
- profile image
- city
- state/region
7. Full leader address should remain private unless a future business rule explicitly allows broader sharing.

## Critical Virtual Session Rules

1. Sessions/events must support delivery_type values such as:
- in_person
- virtual
- hybrid

2. If delivery_type is virtual or hybrid with participant virtual access:
- meeting_url is required
- publishing should be blocked if meeting_url is absent
- participant-facing interfaces must show a Join Meeting action
- opening the meeting link should use the appropriate platform/app where possible

3. Safe virtual fields may include:
- meeting_platform
- meeting_url
- meeting_instructions
- meeting_id
- meeting_passcode

4. Active meeting links should not be exposed on fully public workshop pages by default. They should generally be visible only to authenticated registered participants.

## Product Principles

1. Offline-first mobile experience
Workshop data must remain usable on mobile without connectivity after it has been downloaded.

2. Shared identity
Participants, leaders, and organizers use one central account system. Participants must be able to log in on both mobile and web with the same account.

3. Role-based access
UI, data access, and operations must be role-aware:
- participant
- leader
- organizer/admin

4. Trust and consent
Leaders must be invited and must accept before they are publicly displayed as confirmed.

5. Privacy and least privilege
Participant phone numbers, rosters, and operational details must only be visible where necessary.

6. Multi-tenant safety
Organization data must be strongly scoped by tenant boundaries.

7. Extensible SaaS architecture
The system must be designed so future enhancements like discovery, registration, payments, analytics, community features, social login, and enterprise identity features can be added without major refactoring.

## Brand and UI Requirements

Wayfield should feel:
- creative but structured
- artistic but professional
- modern but approachable
- premium but practical

### Color Palette
- Primary Teal: #0FA3B1
- Burnt Orange: #E67E22
- Coral Red: #E94F37
- Muted Sky Blue: #7EA8BE
- Dark Charcoal: #2E2E2E
- Light Gray: #F5F5F5
- White: #FFFFFF

### Color Usage
- Teal for primary actions, active states, core CTAs
- Orange for secondary emphasis
- Coral for urgent alerts, destructive states, declined/no-show states
- Blue for informational UI
- Use neutral surfaces and restrained color usage

### Typography
- Headings: Sora
- Body/UI: Plus Jakarta Sans
- Optional accent: JetBrains Mono

### Visual Style
- clean
- modern
- card-based where useful
- rounded corners
- soft shadows
- generous spacing
- readable and practical in the field

## Core Roles

### Participant
Can:
- register and log in on web and mobile
- verify email
- manage profile and preferences
- join workshops using a code
- view workshop overview and hotel/logistics info
- view sessions and leaders
- select sessions in session-based workshops
- view personal schedule
- self-check-in
- receive email and push notifications
- use downloaded workshop data offline

Cannot:
- see other participants' phone numbers
- manage workshops
- see private rosters

### Leader
Can:
- receive invitation email
- accept or decline workshop/session participation
- complete and edit their own leader profile
- view assigned workshops and sessions
- view roster for assigned sessions only
- see participant phone numbers for assigned sessions only
- monitor participant self-check-in
- check in participants manually
- mark no-show
- override attendance for assigned sessions only
- send participant notifications only within approved constraints for their assigned sessions

Cannot:
- see rosters for unassigned sessions
- see private participant data beyond assigned operational scope
- message participants outside the approved scope/window

### Organizer/Admin
Can:
- create organizations
- manage organization contacts
- manage multiple organization managers
- manage workshops
- manage sessions, tracks, locations, hotel info
- set optional capacities for sessions/events
- manage leaders and invitations
- view invitation status
- send notifications and emails
- view attendance and reports
- manage subscription-aware features
- manage public workshop page content

## Core Functional Requirements

### Workshop Model
Support:
- SESSION_BASED workshops
- EVENT_BASED workshops

Workshops must support:
- title
- description
- organization
- status
- start/end date
- timezone
- join code
- default location
- hotel/logistics information
- public page visibility
- associated leaders

### Default Location
A workshop has a default location. If a session does not define its own location, the system must fall back to the workshop default.

### Hotel and Logistics
Workshops may include:
- hotel name
- hotel address
- hotel phone
- hotel notes
- parking details
- meeting room details
- meetup instructions

This data must appear in:
- participant workshop overview
- public workshop page
- organizer workshop editor

### Sessions and Tracks
Tracks are optional and relevant mainly to session-based workshops.

Sessions must support:
- workshop association
- optional track
- title
- description
- start/end time
- leader assignment
- optional capacity
- session location override
- delivery_type
- virtual meeting fields where needed
- attendance tracking
- notes or preparation details

Event-based schedule items use the same session/event structure and may also define optional capacity.

### Session Selection and Capacity
For session-based workshops:
- participants can select sessions
- overlapping sessions should not both be selectable unless a future policy says otherwise
- selected sessions appear in My Schedule
- capacity limits must be enforced when capacity is present

For event-based workshops:
- selection may not be required
- schedule is primarily informational
- if an event item is capacity-limited and registration/RSVP is modeled, capacity must still be enforced

### Leaders
Leaders are global entities. They can be linked to multiple organizations.

Leaders support:
- first_name
- last_name
- display_name (optional/derived)
- bio
- image
- website
- email
- phone number
- address_line_1
- address_line_2
- city
- state_or_region
- postal_code
- country
- links to organizations
- links to workshops and sessions

### Leader Invitations
Organizations can invite leaders.
Invitation statuses:
- pending
- accepted
- declined
- expired
- removed

Only accepted leaders should appear publicly as confirmed.

### Leader Profile Completion
The leader invitation flow must support:
- accepting or declining the invitation
- completing or updating leader profile information after invitation
- profile ownership by the leader
- reuse of leader profile data across organizations and workshops

### Public Leader Visibility
Public/participant workshop pages should only expose:
- name
- profile image
- bio snippet
- website
- city
- state_or_region

### Attendance
Attendance must support:
- participant self-check-in
- leader manual check-in
- leader no-show marking
- organizer visibility
- method tracking
- timestamp tracking
- manual actor tracking

### Leader Messaging Constraint
Leaders may send notifications only:
- to participants in sessions they are assigned to
- within an approved time window around those sessions

Recommended default:
- 4 hours before session start through 2 hours after session end

All leader-sent participant notifications should be logged and auditable.

### Participant Phone Number Privacy
Participant phone numbers should only be visible to:
- assigned leaders for relevant sessions
- organizers/admins of the organization

Never expose them publicly or to unrelated leaders or participants.

### Shared Identity and Email
Users must support:
- first_name and last_name
- email address and password as primary login
- shared web/mobile login
- email verification
- password reset
- future Google/Facebook login linkage
- future 2FA
- communication preferences
- future saved preferences for discovery

### Email System
Support:
- verification emails
- password reset emails
- join confirmation emails
- leader invitation emails
- important workshop change emails
- reminder automation emails

### Notifications
Support:
- push notifications
- in-app notification center
- email notifications where relevant
- urgent/general notification types

### Subscription Model
Participants are free.
Organizations/admins are on a freemium tiered plan.

Support plan examples:
- Free
- Starter
- Pro

Gateable features may include:
- CSV import
- advanced notifications
- analytics
- participant limits
- workshop limits
- multi-track support, depending final pricing decision

Feature gating must be enforced in:
- backend/business rules
- frontend/admin UI

## Technical Direction

Recommend and use a modern but practical stack. Default recommendation:
- Backend API: Laravel
- Database: MySQL
- Mobile: Expo / React Native
- Web: Next.js or React
- Push notifications: Firebase Cloud Messaging / Expo push
- Email: AWS SES or comparable provider
- Queues/background jobs: SQS or Laravel queue workers
- File storage: S3
- CDN: CloudFront
- Hosting: AWS
- Monitoring: CloudWatch and Sentry
- CI/CD: GitHub Actions

## Delivery Expectations

When asked to generate assets, produce:
- production-oriented schema
- phased implementation plan
- prompts for each phase
- API route suggestions
- migration guidance
- module boundaries
- testing guidance
- assumptions and open questions where useful

## Testing Guidance

Use persona-driven and regression-driven thinking.

Core test areas:
- cross-platform login
- email verification
- email/password authentication
- workshop join via code
- Google/Facebook account linkage readiness
- 2FA readiness
- leader invitation acceptance
- leader profile completion after invitation
- participant session selection conflict prevention
- participant self-check-in
- leader attendance override
- roster privacy
- public workshop page data exposure
- public leader city/state-only exposure
- offline workshop data access
- notification delivery
- email automation behavior
- subscription gating
- first_name and last_name required behavior
- organization contact management
- multiple organization manager support
- capacity enforcement when capacity is present
- unlimited behavior when capacity is null
- virtual meeting link enforcement

## Important Implementation Notes

Do not:
- expose private phone numbers publicly
- show unconfirmed leaders as confirmed
- assume leaders belong to only one organization
- make mobile online-only
- make participant accounts platform-specific
- treat attendance as leader-only
- store people as name-only records when first and last name are required
- expose full leader address publicly
- enforce capacity in the UI only
- require active meeting links to appear on fully public workshop pages by default

Prioritize:
- maintainability
- correctness
- privacy
- extensibility
- phased delivery
- realistic solo-builder implementation