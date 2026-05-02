# Wayfield Command Center
# Design System Notes
# Read before writing any CC frontend code

> This file documents CC-specific design constraints and patterns.
> It extends the main Wayfield design system. Where this file and the
> main design system conflict, this file takes precedence for CC only.

---

## Non-Negotiable Rules

1. **No `@tremor/react`** — It was removed due to a React 19 dependency conflict.
   Do not install it. Do not import it. Do not reference it in any prompt.

2. **No other component libraries** — No shadcn/ui, no Radix, no Headless UI.
   Use plain Tailwind CSS utility classes only.

3. **Charts use `recharts` only** — No Chart.js, no Plotly, no D3 directly.
   `recharts` is already installed.

4. **Icons use `lucide-react` only** — Already installed. Exact component
   names are specified in `CC_NAVIGATION_SPEC.md`.

---

## Color Palette

Inherited from the main Wayfield design system. Use these exact values:

| Name | Hex | Usage in CC |
|------|-----|-------------|
| Primary Teal | `#0FA3B1` | Active nav, primary CTAs, stat highlights |
| Burnt Orange | `#E67E22` | Warning states, pending indicators |
| Coral Red | `#E94F37` | Error states, suspended orgs, failed jobs |
| Muted Sky Blue | `#7EA8BE` | Informational labels, secondary data |
| Dark Charcoal | `#2E2E2E` | Primary text, headings |
| Light Gray | `#F5F5F5` | Page backgrounds, card surfaces |
| White | `#FFFFFF` | Card backgrounds |

Tailwind `gray-*` scale used for all UI chrome (borders, muted labels, dividers).

---

## Typography

| Role | Font | Tailwind class pattern |
|------|------|----------------------|
| Page headings | Sora | `font-heading text-2xl font-semibold` |
| Section headings | Sora | `font-heading text-lg font-semibold` |
| Body / UI | Plus Jakarta Sans | `font-sans text-sm` |
| Data / metadata | JetBrains Mono | `font-mono text-xs` |
| Nav section labels | JetBrains Mono | `font-mono text-xs uppercase tracking-widest` |
| Stat numbers (large) | Sora | `font-heading text-3xl font-bold` |

Fonts are loaded via `next/font/google`. They must be configured in the
root layout and applied via CSS variables:
- `--font-heading` → Sora
- `--font-sans` → Plus Jakarta Sans
- `--font-mono` → JetBrains Mono

---

## Spacing

8pt grid. Use Tailwind spacing scale (`p-2` = 8px, `p-4` = 16px, `p-8` = 32px).
Page content padding: `px-8 py-6`.
Card padding: `p-6`.
Card gap in grids: `gap-4` or `gap-6`.

---

## Cards

```tsx
// Standard stat card pattern
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
  <p className="font-mono text-xs uppercase tracking-widest text-gray-400 mb-1">
    Metric Label
  </p>
  <p className="font-heading text-3xl font-bold text-charcoal">
    {value}
  </p>
  <p className="text-sm text-gray-500 mt-1">
    Supporting context
  </p>
</div>
```

Locked/gated cards (for plan-restricted content in organizer dashboard — not CC):
- CC has no gated features. The Command Center is platform-admin only and sees everything.
- Do not add lock states or plan gates to any CC UI.

---

## Tables

Use plain HTML `<table>` with Tailwind classes. No external table library.

```tsx
<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="text-left px-6 py-3 font-mono text-xs uppercase tracking-widest text-gray-500">
          Column
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-100">
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-6 py-4 text-gray-900">Value</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## Status Badges

```tsx
// Active / healthy
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
  Active
</span>

// Warning / pending
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
  Pending
</span>

// Error / suspended / failed
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
  Suspended
</span>

// Neutral / inactive
<span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
  Inactive
</span>
```

---

## recharts Patterns

All charts use the Wayfield color palette. Standard config:

```tsx
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

// Standard line chart
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
    <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
    <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
    <Tooltip />
    <Line type="monotone" dataKey="value" stroke="#0FA3B1" strokeWidth={2} dot={false} />
  </LineChart>
</ResponsiveContainer>

// Standard bar chart
<ResponsiveContainer width="100%" height={200}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
    <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
    <YAxis tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
    <Tooltip />
    <Bar dataKey="value" fill="#0FA3B1" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

---

## Modals / Dialogs

Use plain Tailwind with a backdrop overlay. No dialog library.

```tsx
// Backdrop
<div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
  // Modal panel
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 z-50">
    <h2 className="font-heading text-lg font-semibold text-charcoal mb-4">
      Modal Title
    </h2>
    {/* content */}
    <div className="flex justify-end gap-3 mt-6">
      <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm bg-[#0FA3B1] text-white rounded-lg hover:bg-[#0d8f9c]">
        Confirm
      </button>
    </div>
  </div>
</div>
```

Destructive action modals (suspend, delete) use Coral Red for the confirm button:
`bg-[#E94F37] hover:bg-[#d44430]`

---

## Alert Banners

System-level alerts at the top of the page (above page heading):

```tsx
// Error alert
<div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-6">
  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
  <p className="text-sm text-red-700">Alert message here.</p>
</div>

// Warning alert
<div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center gap-3 mb-6">
  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
  <p className="text-sm text-orange-700">Warning message here.</p>
</div>
```

---

## Empty States

Every list or table must handle the empty case:

```tsx
<div className="text-center py-16">
  <Icon className="w-8 h-8 text-gray-300 mx-auto mb-3" />
  <p className="text-sm font-medium text-gray-500">No items found</p>
  <p className="text-xs text-gray-400 mt-1">Contextual explanation here.</p>
</div>
```

---

## Loading States

Use skeleton shimmer divs, not spinners:

```tsx
<div className="animate-pulse bg-gray-100 rounded-lg h-8 w-48" />
```

For tables: render 5 skeleton rows while data loads.
For stat cards: render gray rectangles at the expected dimensions.

---

## Pagination

Simple previous/next with page indicator. No complex pagination library.

```tsx
<div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
  <p className="text-xs font-mono text-gray-500">
    Showing {from}–{to} of {total}
  </p>
  <div className="flex gap-2">
    <button disabled={page === 1} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40">
      Previous
    </button>
    <button disabled={!hasMore} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40">
      Next
    </button>
  </div>
</div>
```

---

## API Client

All CC API calls go to the Laravel API at `NEXT_PUBLIC_API_URL`.
Use a shared `api.ts` utility that attaches the platform admin auth token
from the session cookie or localStorage.

Do not use React Query or SWR in the CC — use `useEffect` + `useState`
with `async/await` fetch calls. Keep it simple.

---

## General Code Rules

- TypeScript strict mode. No `any`.
- All new components have a corresponding type file or inline types.
- No business logic in page components — extract to hooks.
- Server Components where data fetching is straightforward.
- Client Components only where interactivity is required (`"use client"`).
- `next/navigation` for routing (`useRouter`, `redirect`).
