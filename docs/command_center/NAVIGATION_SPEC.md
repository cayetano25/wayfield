# Command Center — Navigation Specification
## docs/command_center/NAVIGATION_SPEC.md

> **Status:** Specification only. CC-Web frontend not yet built.
> **Authority:** This file is canonical. No CC phase may add, remove, or rename
> navigation items without a corresponding update to this file and a
> DECISIONS.md entry. Claude Code must read this file before writing any
> navigation or layout code.

---

## Design Philosophy

The Command Center navigation follows **Apple Human Interface Guidelines (HIG)**
principles adapted for a web application context:

- **Clarity:** Every navigation item is immediately understandable. Labels are nouns,
  not verbs. Icons reinforce meaning, never replace it.
- **Deference:** The interface defers to the content. Navigation chrome is present
  but unobtrusive — dark and receding so the main content area commands attention.
- **Depth and Hierarchy:** The persistent sidebar represents the top level. Within each
  section, depth is added through tabs (organisation detail) and slide-overs (user detail),
  not through nested sidebar items.
- **Feedback:** Every navigation action and state change has immediate, clear feedback.
- **Consistency:** Every screen in the CC shares the same shell, the same top bar,
  and the same sidebar. There are no exceptions.

---

## Shell Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  ▪ WAYFIELD  Command Center    [Admin Full Name] [Role] [Logout] │  ← Top bar
├───────────────┬──────────────────────────────────────────────────┤
│               │                                                  │
│  SIDEBAR      │  MAIN CONTENT AREA                              │
│  dark bg      │  light bg (#F8F9FA or white)                    │
│  w-56 fixed   │  flex-1, overflow-y-auto                        │
│               │  px-8 py-6                                      │
│  nav items    │                                                  │
│               │  [Page title area]                              │
│  ─────────    │  [Content]                                      │
│  [Role badge] │                                                  │
│  [Logout]     │                                                  │
│               │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

### Top Bar
- Left: Wayfield logo mark (small, white) + "WAYFIELD" wordmark + separator + "Command Center" (small, gray-400, font-mono)
- Right (flex row, gap-4): Admin full name (white, font-medium) → Role badge → Logout button
- Background: same dark color as sidebar (`#111827` or `gray-900`)
- Height: 56px fixed
- Full width (spans sidebar + content)

### Sidebar
- Background: `#111827` (gray-900) — dark, not black
- Width: 224px (w-56) fixed, full viewport height
- Padding: `px-4 py-6`
- Logo area at top: 48px height
- Navigation sections below logo
- Role badge + admin name at the very bottom of sidebar (above nothing)
- No horizontal scrolling, no collapse/expand in this phase

### Main Content Area
- Background: `#F9FAFB` (gray-50)
- Left margin: 224px (sidebar width)
- Top margin: 56px (top bar height)
- Padding: `px-8 py-8`
- Max width: none — fills available space
- Page title pattern: H1 in Sora, 24px, gray-900, with optional subtitle in Plus Jakarta Sans, 14px, gray-500

---

## Sidebar Navigation Items

Listed in display order. Role visibility determines whether items render at all.
**Hidden items are not rendered** — they are not greyed out, not disabled, not shown
with a lock icon. They simply do not appear. This is Apple HIG's approach to progressive
disclosure: don't present options that aren't available.

### Section: Platform (no section label in sidebar — these are top-level items)

| Item | Icon (lucide-react) | Route | Visible to |
|---|---|---|---|
| Overview | `LayoutDashboard` | `/` | All roles |
| Organisations | `Building2` | `/organizations` | All roles |
| Users | `Users` | `/users` | `super_admin`, `admin`, `support` |
| Financials | `CreditCard` | `/financials` | `super_admin`, `billing` |
| Support | `MessageCircle` | `/support` | `super_admin`, `admin`, `support` |

### Divider (thin horizontal rule, gray-800)

### Section: Operations (no label)

| Item | Icon (lucide-react) | Route | Visible to |
|---|---|---|---|
| Automations | `Zap` | `/automations` | `super_admin`, `admin` |
| Security | `Shield` | `/security` | `super_admin`, `admin`, `support` |
| Audit Log | `ClipboardList` | `/audit` | `super_admin`, `admin` |
| Settings | `Settings` | `/settings` | `super_admin` only |

---

## Navigation Item States

### Active State
- Left border: 2px solid `#0FA3B1` (Primary Teal)
- Background: `rgba(15, 163, 177, 0.10)` (teal at 10% opacity)
- Icon: `#0FA3B1`
- Label: white, font-medium

### Inactive State
- No left border
- No background
- Icon: `#6B7280` (gray-500)
- Label: `#9CA3AF` (gray-400), font-normal

### Hover State (inactive items only)
- Background: `rgba(255,255,255,0.05)`
- Icon: `#D1D5DB` (gray-300)
- Label: `#D1D5DB`
- Transition: 150ms ease

### Item Dimensions
- Height: 40px (10rem) — minimum 44px touch target area (Apple HIG)
- Padding: `px-3 py-2`
- Icon size: 18px
- Icon-to-label gap: `gap-3`
- Border radius: `rounded-lg`

---

## Role Badges

Role badges appear in the top bar (next to admin name) and in Settings > Admin Users.
Shape: small pill, font-mono, uppercase, 11px, letter-spacing-wide.

| Role | Background | Text | Example |
|---|---|---|---|
| `super_admin` | `#E94F37` at 15% opacity | `#E94F37` | `SUPER ADMIN` |
| `admin` | `#3B82F6` at 15% opacity | `#3B82F6` | `ADMIN` |
| `support` | `#8B5CF6` at 15% opacity | `#8B5CF6` | `SUPPORT` |
| `billing` | `#E67E22` at 15% opacity | `#E67E22` | `BILLING` |
| `readonly` | `#6B7280` at 15% opacity | `#6B7280` | `READ ONLY` |

---

## Routes and Directory Structure

All routes use Next.js App Router. The `(admin)` route group applies the authenticated
layout to all protected pages.

```
command/
  app/
    layout.tsx                    ← root layout (fonts, providers)
    login/
      page.tsx                    ← /login (public, no sidebar)
    (admin)/
      layout.tsx                  ← authenticated shell (sidebar + top bar + route guard)
      page.tsx                    ← / (Overview Dashboard)
      organizations/
        page.tsx                  ← /organizations (list)
        [id]/
          page.tsx                ← /organizations/{id} (detail, tabs)
      users/
        page.tsx                  ← /users (list + slide-over)
      financials/
        page.tsx                  ← /financials
      support/
        page.tsx                  ← /support
      automations/
        page.tsx                  ← /automations (list)
        new/
          page.tsx                ← /automations/new
        [id]/
          page.tsx                ← /automations/{id} (edit)
      security/
        page.tsx                  ← /security
      audit/
        page.tsx                  ← /audit
      settings/
        page.tsx                  ← /settings
```

---

## Route Guards

### Authentication Guard
Applied in `(admin)/layout.tsx`. Logic:
1. Read `cc_platform_token` from localStorage
2. If absent → redirect to `/login`
3. Call `GET /api/platform/v1/me` with the token
4. If 401 → clear token, redirect to `/login`
5. If success → set AdminUserContext, render children

### Role Guard (per-route)
Applied at the top of each page component that has role restrictions.

```typescript
// Example role guard pattern
const { adminUser } = useAdminUser();
if (!['super_admin', 'billing'].includes(adminUser.role)) {
  redirect('/');
}
```

Role-restricted routes:
- `/financials` — `super_admin`, `billing` only → others redirect to `/`
- `/users` — `super_admin`, `admin`, `support` only → others redirect to `/`
- `/automations` — `super_admin`, `admin` only → others redirect to `/`
- `/audit` — `super_admin`, `admin` only → others redirect to `/`
- `/settings` — `super_admin` only → others redirect to `/`
- `/support` — `super_admin`, `admin`, `support` only → others redirect to `/`
- `/security` — `super_admin`, `admin`, `support` only → others redirect to `/`

---

## Organisation Detail Tabs

The organisation detail page (`/organizations/{id}`) uses an in-page tab system.
Tabs are not separate routes — they use query params (`?tab=billing`).

| Tab | Query | Visible to |
|---|---|---|
| Overview | `?tab=overview` (default) | All roles |
| Billing | `?tab=billing` | `super_admin`, `billing`, `admin` (read-only for `admin`) |
| Feature Flags | `?tab=flags` | `super_admin`, `admin` (mutations); `support`, `billing` cannot see this tab |
| Usage | `?tab=usage` | All roles |
| Audit | `?tab=audit` | `super_admin`, `admin` |

Tab bar styling:
- Underline style (not pill/card tabs)
- Active tab: `#0FA3B1` underline, 2px, label white
- Inactive tab: gray-400 label, no underline
- Tab height: 44px (Apple HIG minimum touch target)

---

## Slide-Overs vs Modals

The CC uses two overlay patterns. Use them consistently:

### Slide-Over (right panel, partial screen)
Use for: detail views with significant content (user detail, rule editor).
- Width: 480px on desktop, full-screen on mobile (not applicable — CC is desktop-only)
- Overlay: `rgba(0,0,0,0.4)` backdrop
- Animation: slides in from the right, 200ms ease-out
- Always has a close button (X) top-right
- Can be closed by clicking the backdrop

### Modal (centred dialog)
Use for: confirmations, simple forms, single-action dialogs.
- Max width: 480px
- Overlay: `rgba(0,0,0,0.5)` backdrop
- Animation: fade in + scale from 95% to 100%, 150ms ease-out
- Always has Cancel and Confirm/Submit buttons
- Destructive actions (deactivate, plan downgrade) use Coral Red confirm button
- Cannot be closed by clicking the backdrop (prevents accidental dismissal of destructive actions)

---

## Empty, Loading, and Error States

Apple HIG requires that every possible state is designed. No screen may show raw
JavaScript errors, blank pages, or undefined values.

### Loading State
Use skeleton shimmer placeholders at the correct dimensions.
Never show a full-page spinner — show content skeletons in place.

```
Stat card skeleton: w-full h-24 rounded-xl bg-gray-200 animate-pulse
Table row skeleton: w-full h-12 rounded bg-gray-100 animate-pulse (×5 rows)
Chart skeleton: w-full h-48 rounded-xl bg-gray-100 animate-pulse
```

### Empty State
Every list or table must have an empty state. Pattern:

```
[Icon — 32px, gray-300, centered]
[Heading — "No organisations found" — Sora, 16px, gray-500]
[Subtitle — contextual explanation — Plus Jakarta Sans, 14px, gray-400]
[Optional: Primary action button if creation is possible from this screen]
```

### Error State
When an API call fails, show an inline error banner (not a full-page error):

```
[AlertTriangle icon — 16px, red-500]
"Failed to load data."
[Retry button]
```

---

## Feedback and Toasts

Apple HIG: every user action must acknowledge. Use toast notifications for
operation outcomes. Toasts appear top-right, stack if multiple, auto-dismiss at 4 seconds.

| Situation | Toast style | Message pattern |
|---|---|---|
| Mutation success | Green background, CheckCircle icon | "Plan updated successfully" |
| Mutation failure | Red background, AlertCircle icon | "Failed to update plan. Try again." |
| Info / notice | Blue background, Info icon | "Changes may take a moment to reflect." |

Toast dimensions: `min-w-64 max-w-sm`, `rounded-xl`, `shadow-lg`, `px-4 py-3`.

---

## Accessibility Requirements (Apple HIG + WCAG AA)

1. **Contrast:** All text on dark sidebar must meet 4.5:1 contrast ratio minimum.
   Inactive nav labels (gray-400 on gray-900): verified to pass.
   Active nav labels (white on teal-tinted bg): verified to pass.

2. **Focus states:** All interactive elements must have visible focus rings.
   Use `focus-visible:ring-2 focus-visible:ring-[#0FA3B1] focus-visible:outline-none`.

3. **Keyboard navigation:** Sidebar items must be keyboard-navigable (Tab + Enter).
   Modals must trap focus. Escape closes modals and slide-overs.

4. **Touch targets:** All buttons and interactive elements: minimum 44×44px
   (Apple HIG requirement). Applied via `min-h-[44px] min-w-[44px]`.

5. **Screen reader labels:** Icons without visible labels use `aria-label`.
   Sidebar nav items use `aria-current="page"` for the active item.

6. **No color-only information:** Status badges use both color and text.
   Severity badges use both color and text label.
