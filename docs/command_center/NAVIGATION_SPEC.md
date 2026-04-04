# Wayfield Web Admin — Navigation Specification

## Authority
This file is the canonical definition of all navigation in the web admin app.
Claude Code must read this file before building any screen that includes navigation.
Do NOT invent, add, remove, or reorder navigation items.
Do NOT modify the left sidebar structure between phases.
Every screen must use the AdminShell component defined in Phase 1.

---

## Left Sidebar — Permanent Structure

The sidebar is fixed, always visible on desktop (≥1024px), and a slide-over
drawer on mobile (<1024px). It never changes between screens.

### Width
- Desktop: 240px fixed
- Collapsed (future): 64px icon-only (scaffold the toggle, keep expanded by default)

### Header
Wayfield wordmark in Sora font, teal #0FA3B1
Below wordmark: organization name in small gray text (from UserContext)

### Navigation Items (in exact order, no deviations)

```
┌─────────────────────────────┐
│  Wayfield                   │
│  Cascade Photo Workshops ↓  │
├─────────────────────────────┤
│  [LayoutDashboard] Dashboard│
│  [CalendarDays]  Workshops  │
│                             │
│  ORGANIZATION               │
│  [Building2]   Settings     │
│  [Users]       Members      │
│  [CreditCard]  Billing      │
│                             │
│  [BarChart3]   Reports      │
├─────────────────────────────┤
│  [HelpCircle]  Help         │
├─────────────────────────────┤
│  [avatar] Jordan Alvarez    │
│  Owner · [LogOut] Sign out  │
└─────────────────────────────┘
```

All icons are from lucide-react. Exact icon names:
- Dashboard:   `LayoutDashboard`
- Workshops:   `CalendarDays`
- Settings:    `Building2`
- Members:     `Users`
- Billing:     `CreditCard`
- Reports:     `BarChart3`
- Help:        `HelpCircle`
- Sign out:    `LogOut`

### Section Labels
"ORGANIZATION" is a non-clickable section label above Settings/Members/Billing.
Style: uppercase, 10px, letter-spacing wider, gray #9CA3AF, padding 8px 16px.

### Active State
Active item: teal left border (3px solid #0FA3B1), teal text (#0FA3B1),
background tint (#0FA3B1 at 8% opacity).
All other items: dark charcoal text (#2E2E2E), transparent background.
Hover: light gray background (#F5F5F5).

### Role-Gated Items
Billing item: only visible when user role is 'owner' or 'billing_admin'.
If the user's role is 'staff' or 'admin' without billing access,
the Billing item is completely hidden (not just grayed out).

### Footer
Always at the bottom of the sidebar:
- User avatar (initials in teal circle if no photo)
- User first_name + last_name
- Role badge (small pill: owner/admin/staff/billing_admin)
- Sign Out button (text link with LogOut icon)

---

## Top Bar

Height: 64px. White background. Bottom border: 1px solid #E5E7EB.

Left: Page title (current page name in Sora, 20px, semibold).
Right (from right to left):
  1. System announcement bell icon (MegaphoneIcon, shows count badge if active announcements)
  2. Notifications bell (BellIcon)
  3. User name + avatar (matches sidebar footer)

The top bar is part of AdminShell — it never changes.

---

## Workshop-Level Secondary Navigation

When a user is inside a specific workshop (/admin/workshops/[id]/*),
a secondary tab bar appears BELOW the top bar and ABOVE the page content.
This is NOT in the sidebar — it is a horizontal tab row.

### Workshop Tabs (in exact order)

```
[Overview] [Sessions] [Leaders] [Participants] [Attendance] [Notifications]
```

Tab style:
- Active: teal underline (2px solid #0FA3B1), teal text
- Inactive: gray text (#6B7280), no underline
- Hover: dark text (#2E2E2E)
- Height: 48px
- Full width of content area
- Bottom border: 1px solid #E5E7EB

These tabs only appear within the /admin/workshops/[id]/ route group.
They are rendered in app/(admin)/workshops/[id]/layout.tsx, not in AdminShell.

### Workshop Tab Routes
- Overview:       /admin/workshops/[id]
- Sessions:       /admin/workshops/[id]/sessions
- Leaders:        /admin/workshops/[id]/leaders
- Participants:   /admin/workshops/[id]/participants
- Attendance:     /admin/workshops/[id]/attendance
- Notifications:  /admin/workshops/[id]/notifications

---

## Breadcrumbs

Breadcrumbs appear in the top bar on pages more than one level deep.
Format: Workshops › Workshop Title › Sessions

Max depth: 3 items. Separator: › in gray.
Last item: not a link. Previous items: links.

Examples:
- /admin/workshops: no breadcrumb (top-level page)
- /admin/workshops/[id]: "Workshops ›" + workshop title
- /admin/workshops/[id]/sessions: "Workshops › Workshop Title › Sessions"
- /admin/organization/settings: "Organization › Settings"

---

## System Announcements Banner

Appears ABOVE the top bar (very top of the page).
Implemented in SystemAnnouncementBanner component.
Fetches from GET /api/v1/system/announcements on every page load.
Returns null (renders nothing) if no active announcements.

One banner per active announcement, stacked vertically.
Order: critical → high → medium → low severity.

Banner anatomy:
  Left border (4px): announcement type color
  Background: type color at 12% opacity
  Icon: type-specific lucide icon (Info, AlertTriangle, Wrench, AlertOctagon, Sparkles)
  Title: bold, 14px
  Message: regular, 14px, truncated to 2 lines with expand option
  Right: X dismiss button (if is_dismissable = true)

Dismissal: stored in localStorage key 'wf_dismissed_announcements' as array of ids.
Dismissed announcements not shown again in this browser session.

Type colors (border + icon color):
  info:        #7EA8BE  (sky blue)
  warning:     #F59E0B  (amber)
  maintenance: #E67E22  (burnt orange)
  outage:      #E94F37  (coral red — full opacity background, white text)
  update:      #0FA3B1  (teal)

---

## Page Layout Grid

Standard page content layout (inside the admin shell):

```
[sidebar 240px] | [content area — fills remaining width]
                |   [top bar 64px]
                |   [announcement banner if active]
                |   [workshop tabs if applicable 48px]
                |   [page content — padding 32px desktop, 16px mobile]
```

Content area max-width: 1280px, centered if viewport is wider.
Page content padding: 32px on all sides on desktop, 16px on mobile.

---

## Mobile Navigation

On mobile (<1024px):
- Sidebar hidden by default
- Hamburger menu icon in top bar (left side) opens sidebar as slide-over
- Workshop tabs become a horizontal scrollable row
- Top bar items collapse: show only notification bell and avatar

---

## Component File Locations

All navigation components live in components/shared/:
  AdminShell.tsx              — outer layout wrapper
  Sidebar.tsx                 — left navigation
  TopBar.tsx                  — top bar with breadcrumbs
  WorkshopTabs.tsx            — workshop-level secondary nav
  SystemAnnouncementBanner.tsx — announcement display

These components are NEVER rebuilt in later phases.
If a phase prompt says to "build the sidebar" or "create the nav",
it means to USE these existing components, not recreate them.

---

## Forbidden Navigation Patterns

Never do any of these:
- Add nav items not listed in this spec
- Reorder nav items
- Change icon names
- Create a new sidebar component in a later phase
- Move the workshop tabs into the sidebar
- Show workshop tabs on non-workshop pages
- Render nav items conditionally based on active route
  (only Billing is role-gated — everything else is always rendered)
- Use a bottom navigation bar (this is a web app, not mobile)
